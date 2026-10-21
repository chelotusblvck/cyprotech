import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  updateInventoryLevelsWorkflow,
  updateProductVariantsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

import { loadPricingConfig } from "../../../lib/pricing"
import { createIntcomexApi, type IntcomexApi } from "../client"
import { INTCOMEX_MODULE } from "../index"
import type IntcomexModuleService from "../service"
import { resolveUsdClp, type ResolvedFx } from "./fx"
import {
  planCatalogSync,
  planRowChange,
  type NewProductPlan,
  type RowChange,
  type RowSnapshot,
  type SyncContext,
} from "./plan"

export type SyncKind = "catalog" | "prices" | "inventory"

export type SyncOptions = {
  // Procesa solo los primeros N productos: pensado para la primera prueba con datos reales.
  limit?: number
  // Calcula y reporta lo que haría, sin escribir nada.
  dryRun?: boolean
  // Permite inyectar un cliente (pruebas); por defecto se elige según las credenciales.
  api?: IntcomexApi
}

type Stats = Record<string, number | string | boolean>

const BATCH_SIZE = 25
const STOCK_LOCATION_NAME = "Intcomex (despacho directo)"

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

const slug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

export const minStockFromEnv = (env: NodeJS.ProcessEnv = process.env) => {
  const value = Number(env.INTCOMEX_MIN_STOCK)
  return Number.isFinite(value) && value >= 0 && env.INTCOMEX_MIN_STOCK !== undefined && env.INTCOMEX_MIN_STOCK !== ""
    ? value
    : 3
}

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

export const buildContext = async (service: IntcomexModuleService): Promise<{ context: SyncContext; fx: ResolvedFx | null }> => {
  let fx: ResolvedFx | null = null
  try {
    fx = await resolveUsdClp(service)
  } catch {
    // Sin tipo de cambio solo se pueden procesar costos en CLP; el resto se informa y se salta.
  }
  return {
    context: { pricing: loadPricingConfig(), usdClp: fx?.rate ?? null, minStock: minStockFromEnv() },
    fx,
  }
}

const withRunLog = async (
  service: IntcomexModuleService,
  kind: SyncKind,
  mock: boolean,
  fn: () => Promise<Stats>,
) => {
  const run = await service.createIntcomexSyncRuns({
    kind,
    status: "running",
    mock,
    started_at: new Date(),
  })
  try {
    const stats = await fn()
    await service.updateIntcomexSyncRuns({
      id: run.id,
      status: "success",
      finished_at: new Date(),
      stats,
    })
    return { runId: run.id, stats }
  } catch (error) {
    await service.updateIntcomexSyncRuns({
      id: run.id,
      status: "failed",
      finished_at: new Date(),
      error: (error as Error).message,
    })
    throw error
  }
}

type Refs = {
  stockLocationId: string
  salesChannelId: string
  shippingProfileId: string
}

export const loadRefs = async (container: MedusaContainer): Promise<Refs> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: locations } = await query.graph({ entity: "stock_location", fields: ["id", "name"] })
  const location = locations.find((entry: { name: string }) => entry.name === STOCK_LOCATION_NAME) ?? locations[0]
  const {
    data: [store],
  } = await query.graph({ entity: "store", fields: ["default_sales_channel_id"] })
  const {
    data: [profile],
  } = await query.graph({ entity: "shipping_profile", fields: ["id"] })

  if (!location || !store?.default_sales_channel_id || !profile) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Falta configuración base (bodega, canal de venta o perfil de despacho). Ejecuta setup-chile.")
  }
  return {
    stockLocationId: location.id,
    salesChannelId: store.default_sales_channel_id,
    shippingProfileId: profile.id,
  }
}

export const createProducts = async (
  container: MedusaContainer,
  service: IntcomexModuleService,
  plans: NewProductPlan[],
  refs: Refs,
  stats: Stats,
) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const handles = [...new Set(plans.map((plan) => plan.categoryHandle).filter(Boolean))] as string[]
  const { data: categories } = handles.length
    ? await query.graph({ entity: "product_category", fields: ["id", "handle"], filters: { handle: handles } })
    : { data: [] }
  const categoryId = new Map(categories.map((entry: { id: string; handle: string }) => [entry.handle, entry.id]))

  for (const batch of chunk(plans, BATCH_SIZE)) {
    const { result } = await createProductsWorkflow(container).run({
      input: {
        products: batch.map((plan) => ({
          title: plan.description.slice(0, 250),
          handle: `${slug(plan.description).slice(0, 80)}-${slug(plan.sku)}`,
          description: plan.details || plan.description,
          status: plan.publishable ? ("published" as const) : ("draft" as const),
          ...(plan.imageUrls?.length
            ? { thumbnail: plan.imageUrls[0], images: plan.imageUrls.map((url) => ({ url })) }
            : {}),
          shipping_profile_id: refs.shippingProfileId,
          category_ids: plan.categoryHandle && categoryId.get(plan.categoryHandle) ? [categoryId.get(plan.categoryHandle)!] : [],
          sales_channels: [{ id: refs.salesChannelId }],
          metadata: {
            supplier: "intcomex",
            sku: plan.sku,
            mpn: plan.mpn,
            brand: plan.brand,
            upc: plan.upc,
          },
          options: [{ title: "Modelo", values: ["Único"] }],
          variants: [
            {
              title: "Único",
              sku: plan.sku,
              manage_inventory: true,
              allow_backorder: false,
              weight: plan.weightGrams ?? undefined,
              options: { Modelo: "Único" },
              prices: [{ currency_code: "clp", amount: plan.publicPrice }],
            },
          ],
        })),
      },
    })

    const variantBySku = new Map<string, { productId: string; variantId: string }>()
    for (const product of result) {
      for (const variant of product.variants ?? []) {
        if (variant.sku) {
          variantBySku.set(variant.sku, { productId: product.id, variantId: variant.id })
        }
      }
    }

    // Medusa crea el item de inventario de cada variante; se leen para fijar el stock inicial.
    const { data: variants } = await query.graph({
      entity: "product_variant",
      fields: ["id", "inventory_items.inventory_item_id"],
      filters: { id: [...variantBySku.values()].map((entry) => entry.variantId) },
    })
    const inventoryByVariant = new Map<string, string>(
      (variants as unknown as { id: string; inventory_items?: { inventory_item_id: string }[] | null }[]).flatMap((variant) =>
        variant.inventory_items?.[0] ? [[variant.id, variant.inventory_items[0].inventory_item_id] as [string, string]] : [],
      ),
    )

    const levels = batch.flatMap((plan) => {
      const ids = variantBySku.get(plan.sku)
      const inventoryItemId = ids && inventoryByVariant.get(ids.variantId)
      return inventoryItemId
        ? [{ inventory_item_id: inventoryItemId, location_id: refs.stockLocationId, stocked_quantity: plan.stock }]
        : []
    })
    if (levels.length) {
      await createInventoryLevelsWorkflow(container).run({ input: { inventory_levels: levels } })
    }

    await service.createIntcomexProducts(
      batch.map((plan) => {
        const ids = variantBySku.get(plan.sku)
        return {
          sku: plan.sku,
          mpn: plan.mpn,
          upc: plan.upc,
          description: plan.description,
          brand: plan.brand,
          category_path: plan.categoryPath,
          category_handle: plan.categoryHandle,
          product_type: "Physical",
          cost_net: plan.costNet,
          cost_currency: plan.currency,
          stock: plan.stock,
          on_sale: plan.onSale,
          image_url: plan.imageUrls?.[0] ?? null,
          source: plan.source ?? "api",
          medusa_product_id: ids?.productId ?? null,
          medusa_variant_id: ids?.variantId ?? null,
          inventory_item_id: (ids && inventoryByVariant.get(ids.variantId)) ?? null,
          public_price: plan.publicPrice,
          active: true,
          last_synced_at: new Date(),
        }
      }),
    )
    stats.created = Number(stats.created ?? 0) + batch.length
  }
}

export const applyChanges = async (
  container: MedusaContainer,
  service: IntcomexModuleService,
  changes: RowChange[],
  refs: Refs,
  stats: Stats,
) => {
  for (const batch of chunk(changes, BATCH_SIZE * 2)) {
    const prices = batch.flatMap((change) => (change.variantPrice ? [change.variantPrice] : []))
    if (prices.length) {
      await updateProductVariantsWorkflow(container).run({
        input: {
          product_variants: prices.map((entry) => ({
            id: entry.variantId,
            prices: [{ currency_code: "clp", amount: entry.amount }],
          })),
        },
      })
      stats.priceUpdates = Number(stats.priceUpdates ?? 0) + prices.length
    }

    const levels = batch.flatMap((change) => (change.stockLevel ? [change.stockLevel] : []))
    if (levels.length) {
      await updateInventoryLevelsWorkflow(container).run({
        input: {
          updates: levels.map((entry) => ({
            inventory_item_id: entry.inventoryItemId,
            location_id: refs.stockLocationId,
            stocked_quantity: entry.quantity,
          })),
        },
      })
      stats.stockUpdates = Number(stats.stockUpdates ?? 0) + levels.length
    }

    const statuses = batch.flatMap((change) => (change.status ? [change.status] : []))
    if (statuses.length) {
      await updateProductsWorkflow(container).run({
        input: { products: statuses.map((entry) => ({ id: entry.productId, status: entry.status })) },
      })
      stats.statusChanges = Number(stats.statusChanges ?? 0) + statuses.length
    }

    await service.updateIntcomexProducts(
      batch.map((change) => ({ id: change.rowId, ...change.patch, last_synced_at: new Date() })),
    )
  }
}

const deactivate = async (
  container: MedusaContainer,
  service: IntcomexModuleService,
  rows: RowSnapshot[],
  refs: Refs,
  stats: Stats,
) => {
  const changes: RowChange[] = rows.map((row) => ({
    rowId: row.id,
    sku: row.sku,
    patch: { stock: 0, active: false },
    stockLevel: row.inventory_item_id ? { inventoryItemId: row.inventory_item_id, quantity: 0 } : undefined,
    status: row.medusa_product_id ? { productId: row.medusa_product_id, status: "draft" as const } : undefined,
  }))
  await applyChanges(container, service, changes, refs, stats)
  stats.deactivated = rows.length
}

// En producción el catálogo simulado nunca se carga: crearía productos falsos a la venta. Sin credenciales
// de Intcomex la sincronización se niega (el dashboard muestra el motivo). Fuera de producción, el
// simulado sirve para probar el ciclo completo.
export const assertSyncAllowed = (api: IntcomexApi, env: NodeJS.ProcessEnv = process.env) => {
  if (api.isMock && env.NODE_ENV === "production") {
    throw new Error(
      "Intcomex no está configurado en producción (faltan INTCOMEX_API_KEY e INTCOMEX_ACCESS_KEY): no se sincroniza el catálogo simulado.",
    )
  }
}

export const syncCatalog = async (container: MedusaContainer, options: SyncOptions = {}) => {
  const service: IntcomexModuleService = container.resolve(INTCOMEX_MODULE)
  const api = options.api ?? createIntcomexApi()
  assertSyncAllowed(api)

  return withRunLog(service, "catalog", api.isMock, async () => {
    const catalog = await api.getCatalog()
    const { context, fx } = await buildContext(service)
    const rows = await listAllRows(service)
    const plan = planCatalogSync(catalog, rows, context, { limit: options.limit })

    const stats: Stats = {
      ...plan.stats,
      toCreate: plan.toCreate.length,
      toUpdate: plan.changes.length,
      toDeactivate: plan.toDeactivate.length,
      fx: fx?.rate ?? "sin tipo de cambio",
      fxStale: fx?.stale ?? false,
      dryRun: Boolean(options.dryRun),
    }
    if (options.dryRun) {
      return stats
    }

    const refs = await loadRefs(container)
    await createProducts(container, service, plan.toCreate, refs, stats)
    await applyChanges(container, service, plan.changes, refs, stats)
    if (plan.toDeactivate.length) {
      await deactivate(container, service, plan.toDeactivate, refs, stats)
    }
    return stats
  })
}

const syncFeed = async (
  container: MedusaContainer,
  kind: "prices" | "inventory",
  options: SyncOptions,
) => {
  const service: IntcomexModuleService = container.resolve(INTCOMEX_MODULE)
  const api = options.api ?? createIntcomexApi()
  assertSyncAllowed(api)

  return withRunLog(service, kind, api.isMock, async () => {
    const { context, fx } = await buildContext(service)
    const rows = await listAllRows(service)
    const bySku = new Map(rows.filter((row) => row.active).map((row) => [row.sku, row]))

    const incoming =
      kind === "prices"
        ? (await api.getPriceList()).flatMap((entry) =>
            entry.Sku && entry.UnitPrice > 0
              ? [{ sku: entry.Sku, costNet: entry.UnitPrice, currency: entry.CurrencyId.toUpperCase().startsWith("CL") ? ("CLP" as const) : ("USD" as const) }]
              : [],
          )
        : (await api.getInventory()).map((entry) => ({ sku: entry.Sku, stock: entry.InStock ?? 0 }))

    const changes: RowChange[] = []
    let unknown = 0
    for (const entry of incoming) {
      const row = bySku.get(entry.sku)
      if (!row) {
        unknown++
        continue
      }
      const change = planRowChange(row, entry, context, { reprice: kind === "prices" })
      if (change) {
        changes.push(change)
      }
    }

    const limited = options.limit !== undefined ? changes.slice(0, options.limit) : changes
    const stats: Stats = {
      fetched: incoming.length,
      unknownSku: unknown,
      toUpdate: limited.length,
      fx: fx?.rate ?? "sin tipo de cambio",
      fxStale: fx?.stale ?? false,
      dryRun: Boolean(options.dryRun),
    }
    if (options.dryRun || limited.length === 0) {
      return stats
    }
    await applyChanges(container, service, limited, await loadRefs(container), stats)
    return stats
  })
}

export const syncPrices = (container: MedusaContainer, options: SyncOptions = {}) =>
  syncFeed(container, "prices", options)

export const syncInventory = (container: MedusaContainer, options: SyncOptions = {}) =>
  syncFeed(container, "inventory", options)

export const runSync = (kind: SyncKind, container: MedusaContainer, options: SyncOptions = {}) => {
  switch (kind) {
    case "catalog":
      return syncCatalog(container, options)
    case "prices":
      return syncPrices(container, options)
    case "inventory":
      return syncInventory(container, options)
  }
}

// Evita que dos corridas del mismo tipo se pisen (por ejemplo, un catálogo largo y el siguiente cron).
export const isSyncRunning = async (
  service: IntcomexModuleService,
  kind: SyncKind,
  maxAgeHours = 3,
) => {
  const since = new Date(Date.now() - maxAgeHours * 3_600_000)
  const runs = await service.listIntcomexSyncRuns({ kind, status: "running" })
  return runs.some((run) => new Date(run.started_at) > since)
}

// Los trabajos programados corren solo con credenciales reales, o si se fuerza con
// INTCOMEX_SYNC_ENABLED=true (útil para probar el ciclo completo con el cliente simulado).
export const shouldRunScheduled = (env: NodeJS.ProcessEnv = process.env) => {
  if (env.INTCOMEX_SYNC_ENABLED === "true") {
    return true
  }
  if (env.INTCOMEX_SYNC_ENABLED === "false") {
    return false
  }
  return Boolean(env.INTCOMEX_API_KEY && env.INTCOMEX_ACCESS_KEY)
}
