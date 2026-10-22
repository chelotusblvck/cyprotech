import { readFileSync } from "node:fs"
import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createProductCategoriesWorkflow, updateProductsWorkflow, uploadFilesWorkflow } from "@medusajs/medusa/core-flows"

import { DETAIL_CATEGORY } from "../modules/intcomex/category-map"
import { INTCOMEX_MODULE } from "../modules/intcomex"
import type { ManualProduct } from "../modules/intcomex/manual/normalize"
import type IntcomexModuleService from "../modules/intcomex/service"
import { planCatalogSync, isPublishable, type RowSnapshot } from "../modules/intcomex/sync/plan"
import { applyChanges, buildContext, createProducts, loadRefs } from "../modules/intcomex/sync/run"

// Carga a la tienda los productos que dejó extract-intcomex-urls.ts. Usa el mismo planificador que la
// sincronización con IWS: crea los SKU nuevos y actualiza costo, precio y stock de los que ya existen.
//
// Uso (desde apps/backend):
//   npx medusa exec ./src/scripts/import-intcomex-manual.ts [file=intcomex-manual.json] [dry-run] [publish] [skip-images]
//
// Por defecto los productos nuevos quedan en borrador para revisarlos en el admin. Con "publish" se
// publican los que tengan categoría reconocida y stock suficiente (INTCOMEX_MIN_STOCK).

// Algunas fichas traen galerías de 16 fotos; con las primeras alcanza y la carga no se alarga.
const MAX_IMAGES_PER_PRODUCT = 6

const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" }

const listAllRows = async (service: IntcomexModuleService): Promise<RowSnapshot[]> => {
  const rows: RowSnapshot[] = []
  const take = 1000
  for (let skip = 0; ; skip += take) {
    const [page] = await service.listAndCountIntcomexProducts({}, { skip, take })
    rows.push(...(page as unknown as RowSnapshot[]))
    if (page.length < take) {
      return rows
    }
  }
}

// Descarga las imágenes y las sube al almacenamiento de la tienda, para no depender del sitio de Intcomex.
const uploadImages = async (
  container: MedusaContainer,
  sku: string,
  urls: string[],
  warn: (message: string) => void,
): Promise<string[]> => {
  const files: { filename: string; mimeType: string; content: string; access: "public" }[] = []
  for (const [index, url] of urls.slice(0, MAX_IMAGES_PER_PRODUCT).entries()) {
    try {
      const response = await fetch(url)
      const mimeType = response.headers.get("content-type")?.split(";")[0] ?? ""
      if (!response.ok || !mimeType.startsWith("image/")) {
        warn(`${sku}: no se pudo descargar ${url} (${response.status} ${mimeType})`)
        continue
      }
      const ext = Object.keys(MIME_BY_EXT).find((key) => MIME_BY_EXT[key] === mimeType) ?? "jpg"
      files.push({
        filename: `intcomex-${sku}-${index + 1}.${ext}`,
        mimeType,
        content: Buffer.from(await response.arrayBuffer()).toString("base64"),
        access: "public",
      })
    } catch (error) {
      warn(`${sku}: error descargando ${url}: ${(error as Error).message}`)
    }
  }
  if (files.length === 0) {
    return []
  }
  const { result } = await uploadFilesWorkflow(container).run({ input: { files } })
  return result.map((file) => file.url)
}

// Categoría interna para liquidaciones y productos con empaque dañado: queda fuera del menú y del pie de la tienda.
const ensureDetailCategory = async (container: MedusaContainer) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id"],
    filters: { handle: DETAIL_CATEGORY.handle },
  })
  if (data.length === 0) {
    await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: [{ name: DETAIL_CATEGORY.name, handle: DETAIL_CATEGORY.handle, is_active: true, is_internal: true }],
      },
    })
  }
}

export default async function importIntcomexManual({ container, args = [] }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service: IntcomexModuleService = container.resolve(INTCOMEX_MODULE)

  const file = args.find((arg) => arg.startsWith("file="))?.split("=")[1] ?? "intcomex-manual.json"
  const dryRun = args.includes("dry-run")
  const publish = args.includes("publish")
  const skipImages = args.includes("skip-images")

  let entries: ManualProduct[]
  try {
    entries = JSON.parse(readFileSync(file, "utf8")) as ManualProduct[]
  } catch (error) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `No se pudo leer ${file}: ${(error as Error).message}`)
  }
  if (entries.length === 0) {
    logger.info(`${file} no tiene productos.`)
    return
  }
  const bySku = new Map(entries.map((entry) => [entry.product.Sku, entry]))

  const { context, fx } = await buildContext(service)
  const rows = await listAllRows(service)
  const plan = planCatalogSync(
    entries.map((entry) => entry.product),
    rows,
    context,
    // Es una carga parcial: lo que no viene en el archivo no se toca.
    { deactivateMissing: false },
  )

  // Producto nuevo: ficha larga, origen manual y borrador salvo que se pida publicar.
  const toCreate = plan.toCreate.map((item) => {
    const entry = bySku.get(item.sku)!
    return {
      ...item,
      details: entry.details,
      source: "manual" as const,
      imageUrls: entry.imageUrls,
      publishable: publish && isPublishable(item.categoryHandle, item.stock, context.minStock),
    }
  })

  // Productos ya cargados que quedaron sin imagen (por ejemplo, porque una descarga falló): se completan.
  const rowBySku = new Map(rows.map((row) => [row.sku, row]))
  const missingImages = skipImages
    ? []
    : entries.flatMap((entry) => {
        const row = rowBySku.get(entry.product.Sku)
        return row?.medusa_product_id && !row.image_url && entry.imageUrls.length ? [{ row, entry }] : []
      })

  const needsDetailCategory = toCreate.some((item) => item.categoryHandle === DETAIL_CATEGORY.handle)

  logger.info(
    `${file}: ${entries.length} productos -> ${toCreate.length} nuevos, ${plan.changes.length} a actualizar, ${plan.stats.unchanged} sin cambios. ` +
      `USD/CLP: ${fx?.rate ?? "sin tipo de cambio"}.`,
  )
  if (plan.stats.skippedNoFx) {
    logger.warn(`${plan.stats.skippedNoFx} productos en USD se omitieron porque no hay tipo de cambio disponible.`)
  }
  for (const item of toCreate) {
    const where = item.categoryHandle ?? `SIN CATEGORÍA (${item.categoryPath ?? "?"}): queda en borrador`
    const state = item.publishable ? "publicado" : "borrador"
    logger.info(
      `  + ${item.sku} ${item.description.slice(0, 60)} | costo ${item.costNet} ${item.currency} -> $${item.publicPrice} CLP | stock ${item.stock} | ${where} | ${state}`,
    )
  }
  for (const change of plan.changes) {
    logger.info(`  ~ ${change.sku} ${JSON.stringify(change.patch)}`)
  }
  if (missingImages.length) {
    logger.info(`${missingImages.length} productos ya cargados no tienen imagen: se les agregará.`)
  }
  if (needsDetailCategory) {
    logger.info(`Se usará la categoría interna "${DETAIL_CATEGORY.name}" (se crea si no existe; no aparece en el menú de la tienda).`)
  }
  if (dryRun) {
    logger.info("dry-run: no se escribió nada.")
    return
  }

  if (needsDetailCategory) {
    await ensureDetailCategory(container)
  }
  const stats: Record<string, number | string | boolean> = {}
  if (toCreate.length) {
    if (!skipImages) {
      for (const item of toCreate) {
        item.imageUrls = await uploadImages(container, item.sku, item.imageUrls, (message) => logger.warn(message))
      }
    } else {
      for (const item of toCreate) {
        item.imageUrls = []
      }
    }
    const refs = await loadRefs(container)
    await createProducts(container, service, toCreate, refs, stats)
    if (plan.changes.length) {
      await applyChanges(container, service, plan.changes, refs, stats)
    }
  } else if (plan.changes.length) {
    await applyChanges(container, service, plan.changes, await loadRefs(container), stats)
  }

  for (const { row, entry } of missingImages) {
    const urls = await uploadImages(container, entry.product.Sku, entry.imageUrls, (message) => logger.warn(message))
    if (urls.length === 0) {
      continue
    }
    await updateProductsWorkflow(container).run({
      input: { products: [{ id: row.medusa_product_id!, thumbnail: urls[0], images: urls.map((url) => ({ url })) }] },
    })
    await service.updateIntcomexProducts([{ id: row.id, image_url: urls[0] }])
    stats.imagesAdded = Number(stats.imagesAdded ?? 0) + 1
  }
  logger.info(`Listo: ${JSON.stringify(stats)}`)
}
