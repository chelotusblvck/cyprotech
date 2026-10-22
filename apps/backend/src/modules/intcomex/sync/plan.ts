import { calculatePrice, normalizeCurrency, type PricingConfig } from "../../../lib/pricing"
import { DETAIL_CATEGORY, mapCategory, categoryPath } from "../category-map"
import type { IwsProduct } from "../client/types"

export type SyncContext = {
  pricing: PricingConfig
  // Null cuando no hay tipo de cambio disponible: los costos en USD no se pueden precificar.
  usdClp: number | null
  // Stock mínimo para publicar un producto. Bajo ese nivel se oculta.
  minStock: number
}

// Lo que se sabe de un producto ya sincronizado (fila de intcomex_product).
export type RowSnapshot = {
  id: string
  sku: string
  cost_net: number
  cost_currency: string
  stock: number
  category_handle: string | null
  public_price: number | null
  medusa_product_id: string | null
  medusa_variant_id: string | null
  inventory_item_id: string | null
  active: boolean
  source?: string
}

// Lo que trae Intcomex en cada feed. El catálogo trae todo; precios e inventario, una parte.
export type Incoming = {
  sku: string
  costNet?: number
  currency?: "USD" | "CLP"
  stock?: number
}

export type RowChange = {
  rowId: string
  sku: string
  patch: {
    cost_net?: number
    cost_currency?: string
    stock?: number
    public_price?: number
    active?: boolean
  }
  variantPrice?: { variantId: string; amount: number }
  stockLevel?: { inventoryItemId: string; quantity: number }
  status?: { productId: string; status: "published" | "draft" }
}

export const isPhysical = (product: IwsProduct) =>
  !product.Type || product.Type.toLowerCase() === "physical"

export const totalStock = (product: IwsProduct) =>
  product.InStock ??
  (product.Locations ?? []).reduce((sum, location) => sum + (location.Stock ?? 0), 0)

// Los productos con detalles (liquidación, empaque dañado) nunca se publican solos: se revisan a mano.
export const isPublishable = (handle: string | null, stock: number, minStock: number) =>
  handle !== null && handle !== DETAIL_CATEGORY.handle && stock >= minStock

// Subir de precio siempre se aplica (protege el margen); bajar solo si el cambio es relevante.
export const shouldUpdatePrice = (current: number | null, next: number, minDropPercent = 0.5) => {
  if (current === null || current <= 0) {
    return true
  }
  if (next === current) {
    return false
  }
  if (next > current) {
    return true
  }
  return ((current - next) / current) * 100 >= minDropPercent
}

export const priceFor = (
  incoming: { costNet: number; currency: "USD" | "CLP" },
  context: SyncContext,
) => calculatePrice(incoming, context.usdClp, context.pricing)

// Decide qué hay que escribir para una fila a partir de un dato nuevo de Intcomex.
export const planRowChange = (
  row: RowSnapshot,
  incoming: Incoming,
  context: SyncContext,
  options: { reprice?: boolean } = {},
): RowChange | null => {
  const change: RowChange = { rowId: row.id, sku: row.sku, patch: {} }

  const stock = incoming.stock ?? row.stock
  if (stock !== row.stock) {
    change.patch.stock = stock
    if (row.inventory_item_id) {
      change.stockLevel = { inventoryItemId: row.inventory_item_id, quantity: stock }
    }
    if (row.medusa_product_id) {
      const before = isPublishable(row.category_handle, row.stock, context.minStock)
      const after = isPublishable(row.category_handle, stock, context.minStock)
      if (before !== after) {
        change.status = { productId: row.medusa_product_id, status: after ? "published" : "draft" }
      }
    }
  }

  const costNet = incoming.costNet ?? row.cost_net
  const currency = incoming.currency ?? normalizeCurrency(row.cost_currency)
  if (costNet !== row.cost_net) {
    change.patch.cost_net = costNet
  }
  if (currency !== row.cost_currency) {
    change.patch.cost_currency = currency
  }

  // El precio se recalcula en los feeds de catálogo y precios (cambia con el costo y con el
  // tipo de cambio). El feed de inventario pasa reprice: false y solo toca stock.
  const canPrice = currency === "CLP" || context.usdClp !== null
  if (options.reprice !== false && canPrice && costNet > 0) {
    const price = priceFor({ costNet, currency }, context).publicPrice
    if (shouldUpdatePrice(row.public_price, price)) {
      change.patch.public_price = price
      if (row.medusa_variant_id) {
        change.variantPrice = { variantId: row.medusa_variant_id, amount: price }
      }
    }
  }

  return Object.keys(change.patch).length > 0 ? change : null
}

// Datos listos para crear un producto nuevo en la tienda.
export type NewProductPlan = {
  sku: string
  mpn: string | null
  upc: string | null
  brand: string | null
  description: string
  categoryPath: string | null
  categoryHandle: string | null
  costNet: number
  currency: "USD" | "CLP"
  stock: number
  onSale: boolean
  publicPrice: number
  publishable: boolean
  weightGrams: number | null
  // Solo en la carga manual: ficha larga, imágenes ya subidas a la tienda y origen del dato.
  details?: string
  imageUrls?: string[]
  source?: "api" | "manual"
}

export type CatalogPlan = {
  toCreate: NewProductPlan[]
  changes: RowChange[]
  // Filas que Intcomex ya no lista.
  toDeactivate: RowSnapshot[]
  stats: {
    fetched: number
    skippedNotPhysical: number
    skippedNoPrice: number
    skippedNoFx: number
    unmapped: number
    unchanged: number
  }
}

const weightFrom = (product: IwsProduct): number | null => {
  const pkg = product.Freight?.Package as { Weight?: number | string } | undefined
  const value = Number(pkg?.Weight)
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null
}

export const planCatalogSync = (
  catalog: IwsProduct[],
  rows: RowSnapshot[],
  context: SyncContext,
  options: { limit?: number; deactivateMissing?: boolean } = {},
): CatalogPlan => {
  const stats = {
    fetched: catalog.length,
    skippedNotPhysical: 0,
    skippedNoPrice: 0,
    skippedNoFx: 0,
    unmapped: 0,
    unchanged: 0,
  }
  const bySku = new Map(rows.map((row) => [row.sku, row]))
  const seen = new Set<string>()
  const toCreate: NewProductPlan[] = []
  const changes: RowChange[] = []

  let processed = 0
  for (const product of catalog) {
    if (!product.Sku) {
      continue
    }
    if (!isPhysical(product)) {
      stats.skippedNotPhysical++
      continue
    }
    const costNet = product.Price?.UnitPrice
    if (typeof costNet !== "number" || !(costNet > 0)) {
      stats.skippedNoPrice++
      continue
    }
    if (options.limit !== undefined && processed >= options.limit) {
      break
    }
    processed++

    const currency = normalizeCurrency(product.Price?.CurrencyId)
    if (currency === "USD" && context.usdClp === null) {
      stats.skippedNoFx++
      continue
    }

    seen.add(product.Sku)
    const stock = totalStock(product)
    const handle = mapCategory(product)
    if (!handle) {
      stats.unmapped++
    }

    const existing = bySku.get(product.Sku)
    if (!existing) {
      toCreate.push({
        sku: product.Sku,
        mpn: product.Mpn ?? null,
        upc: product.Upc ?? null,
        brand: product.Brand?.Description ?? product.Manufacturer?.Description ?? null,
        description: product.Description,
        categoryPath: categoryPath(product) || null,
        categoryHandle: handle,
        costNet,
        currency,
        stock,
        onSale: Boolean(product.OnSale),
        publicPrice: priceFor({ costNet, currency }, context).publicPrice,
        publishable: isPublishable(handle, stock, context.minStock),
        weightGrams: weightFrom(product),
      })
      continue
    }

    const change = planRowChange(existing, { sku: product.Sku, costNet, currency, stock }, context)
    if (change) {
      changes.push(change)
    } else {
      stats.unchanged++
    }
  }

  const toDeactivate =
    options.deactivateMissing === false || options.limit !== undefined
      ? []
      : rows.filter((row) => row.active && row.source !== "manual" && !seen.has(row.sku))

  return { toCreate, changes, toDeactivate, stats }
}
