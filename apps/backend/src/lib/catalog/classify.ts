import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

import { detectBrand, GAMER_TAG, isGamer } from "./brands"

type ProductRow = {
  id: string
  title: string
  metadata?: Record<string, unknown> | null
  tags?: { id: string; value: string }[] | null
  categories?: { name?: string | null }[] | null
}

export type ClassifyChange = {
  id: string
  title: string
  brand: string | null
  line: string | null
  gamer: boolean
  changed: boolean
}

export type ClassifyOptions = {
  // Ids a clasificar; sin ids se recorren todos los productos.
  productIds?: string[]
  // Solo calcula y devuelve los cambios.
  dryRun?: boolean
}

// En el admin se puede fijar a mano la clasificacion de un producto con metadata.classification_locked = true.
// Esos productos no se tocan nunca (ni la marca ni la etiqueta gamer).
const isLocked = (metadata: Record<string, unknown> | null | undefined) =>
  metadata?.classification_locked === true || metadata?.classification_locked === "true"

export const classifyProducts = async (
  container: MedusaContainer,
  options: ClassifyOptions = {},
): Promise<ClassifyChange[]> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productService = container.resolve(Modules.PRODUCT)

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "metadata", "tags.id", "tags.value", "categories.name"],
    ...(options.productIds ? { filters: { id: options.productIds } } : {}),
  })
  const products = data as unknown as ProductRow[]

  let gamerTagId: string | null = null
  const ensureGamerTag = async () => {
    if (gamerTagId) {
      return gamerTagId
    }
    const [existing] = await productService.listProductTags({ value: GAMER_TAG })
    gamerTagId = existing?.id ?? (await productService.createProductTags({ value: GAMER_TAG })).id
    return gamerTagId
  }

  const changes: ClassifyChange[] = []
  for (const product of products) {
    if (isLocked(product.metadata)) {
      continue
    }
    const metadata = { ...(product.metadata ?? {}) }
    const rawBrand = typeof metadata.brand_raw === "string" ? metadata.brand_raw : (metadata.brand as string | null)
    const categoryPath = (product.categories ?? []).map((category) => category.name ?? "").join(" / ")
    const match = detectBrand({ title: product.title, brand: rawBrand })
    const gamer = isGamer({ title: product.title, brand: rawBrand, categoryPath })

    const tags = product.tags ?? []
    const hasTag = tags.some((tag) => tag.value === GAMER_TAG)
    const nextMetadata = {
      ...metadata,
      // Se conserva lo que entrego Intcomex antes de unificar la marca.
      brand_raw: rawBrand ?? null,
      brand: match?.brand ?? rawBrand ?? null,
      brand_line: match?.line ?? null,
    }
    const metadataChanged =
      nextMetadata.brand !== metadata.brand ||
      nextMetadata.brand_line !== (metadata.brand_line ?? null) ||
      nextMetadata.brand_raw !== (metadata.brand_raw ?? undefined)
    const changed = metadataChanged || hasTag !== gamer

    changes.push({
      id: product.id,
      title: product.title,
      brand: nextMetadata.brand as string | null,
      line: match?.line ?? null,
      gamer,
      changed,
    })

    if (changed && !options.dryRun) {
      const tagIds = tags.filter((tag) => tag.value !== GAMER_TAG).map((tag) => tag.id)
      if (gamer) {
        tagIds.push(await ensureGamerTag())
      }
      // Con el workflow se emite product.updated y el indice de busqueda (filtros Marca y gaming) se entera.
      await updateProductsWorkflow(container).run({
        input: { selector: { id: product.id }, update: { metadata: nextMetadata, tag_ids: tagIds } },
      })
    }
  }
  return changes
}
