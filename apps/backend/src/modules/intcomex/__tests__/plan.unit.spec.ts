import { MockIntcomexClient } from "../client/mock"
import type { IwsProduct } from "../client/types"
import {
  isPublishable,
  planCatalogSync,
  planRowChange,
  shouldUpdatePrice,
  type RowSnapshot,
  type SyncContext,
} from "../sync/plan"

const context: SyncContext = {
  pricing: { marginPercent: 10, ivaPercent: 19, roundTo: 10, fxBufferPercent: 0, paymentFeePercent: 2.89, minNetMarginPercent: 5 },
  usdClp: 950,
  minStock: 3,
}

const row = (overrides: Partial<RowSnapshot> = {}): RowSnapshot => ({
  id: "icxp_1",
  sku: "S1",
  cost_net: 100,
  cost_currency: "USD",
  stock: 10,
  category_handle: "mouse",
  public_price: 124360,
  medusa_product_id: "prod_1",
  medusa_variant_id: "variant_1",
  inventory_item_id: "iitem_1",
  active: true,
  ...overrides,
})

describe("shouldUpdatePrice", () => {
  it("sube siempre que el precio aumente", () => {
    expect(shouldUpdatePrice(100000, 100010)).toBe(true)
  })
  it("ignora bajas menores a 0,5%", () => {
    expect(shouldUpdatePrice(100000, 99700)).toBe(false)
    expect(shouldUpdatePrice(100000, 99400)).toBe(true)
  })
  it("no cambia si es igual y publica si no había precio", () => {
    expect(shouldUpdatePrice(100000, 100000)).toBe(false)
    expect(shouldUpdatePrice(null, 5000)).toBe(true)
  })
})

describe("isPublishable", () => {
  it("exige categoría y stock mínimo", () => {
    expect(isPublishable("mouse", 3, 3)).toBe(true)
    expect(isPublishable("mouse", 2, 3)).toBe(false)
    expect(isPublishable(null, 50, 3)).toBe(false)
  })

  it("nunca publica productos con detalles, aunque tengan stock", () => {
    expect(isPublishable("productos-con-detalles", 50, 3)).toBe(false)
  })
})

describe("planRowChange", () => {
  it("no hace nada cuando todo coincide", () => {
    expect(planRowChange(row(), { sku: "S1", costNet: 100, currency: "USD", stock: 10 }, context)).toBeNull()
  })

  it("actualiza el nivel de inventario y oculta el producto al caer bajo el mínimo", () => {
    const change = planRowChange(row(), { sku: "S1", stock: 2 }, context)
    expect(change?.stockLevel).toEqual({ inventoryItemId: "iitem_1", quantity: 2 })
    expect(change?.status).toEqual({ productId: "prod_1", status: "draft" })
  })

  it("vuelve a publicar cuando el stock se recupera", () => {
    const change = planRowChange(row({ stock: 0 }), { sku: "S1", stock: 8 }, context)
    expect(change?.status).toEqual({ productId: "prod_1", status: "published" })
  })

  it("no toca el estado si el stock cambia sin cruzar el mínimo", () => {
    const change = planRowChange(row(), { sku: "S1", stock: 7 }, context)
    expect(change?.stockLevel?.quantity).toBe(7)
    expect(change?.status).toBeUndefined()
  })

  it("reprecia cuando sube el costo", () => {
    const change = planRowChange(row(), { sku: "S1", costNet: 110 }, context)
    // 110 x 950 x 1,10 x 1,19 = 136.791,5 -> 136.800
    expect(change?.variantPrice).toEqual({ variantId: "variant_1", amount: 136800 })
    expect(change?.patch.cost_net).toBe(110)
  })

  it("reprecia cuando solo cambia el tipo de cambio", () => {
    const change = planRowChange(row(), { sku: "S1" }, { ...context, usdClp: 1000 })
    expect(change?.variantPrice?.amount).toBe(130900)
  })

  it("el feed de inventario no toca precios aunque cambie el tipo de cambio", () => {
    const change = planRowChange(row(), { sku: "S1", stock: 4 }, { ...context, usdClp: 1000 }, { reprice: false })
    expect(change?.variantPrice).toBeUndefined()
    expect(change?.patch.public_price).toBeUndefined()
    expect(change?.stockLevel?.quantity).toBe(4)
  })

  it("no reprecia en USD si no hay tipo de cambio", () => {
    const change = planRowChange(row(), { sku: "S1", costNet: 120 }, { ...context, usdClp: null })
    expect(change?.variantPrice).toBeUndefined()
    expect(change?.patch.cost_net).toBe(120)
  })
})

describe("planCatalogSync con el catálogo simulado", () => {
  let catalog: IwsProduct[]
  beforeAll(async () => {
    catalog = await new MockIntcomexClient().getCatalog()
  })

  it("crea solo productos físicos con precio y deja fuera los digitales", () => {
    const plan = planCatalogSync(catalog, [], context)
    expect(plan.stats.skippedNotPhysical).toBe(1)
    expect(plan.toCreate.find((p) => p.sku === "SE001MSO01")).toBeUndefined()
    expect(plan.toCreate.length).toBe(catalog.length - 1)
  })

  it("publica solo con categoría reconocida y stock suficiente", () => {
    const plan = planCatalogSync(catalog, [], context)
    const bySku = Object.fromEntries(plan.toCreate.map((p) => [p.sku, p]))
    expect(bySku["MK001GPU01"].publishable).toBe(true)
    // Stock 1 con mínimo 3.
    expect(bySku["MK001GPU04"].publishable).toBe(false)
    // Sin categoría reconocida.
    expect(bySku["MK099ZZ01"].publishable).toBe(false)
    expect(plan.stats.unmapped).toBe(1)
  })

  it("calcula el precio público con la fórmula del negocio", () => {
    const plan = planCatalogSync(catalog, [], context)
    const gpu = plan.toCreate.find((p) => p.sku === "MK001GPU01")!
    // 578,9 x 950 = 549.955; x1,10 = 604.950,5; x1,19 = 719.891,1 -> 719.900
    expect(gpu.publicPrice).toBe(719900)
  })

  it("desactiva lo que Intcomex ya no lista, salvo los productos de carga manual", () => {
    const rows = [row({ id: "icxp_api", sku: "VIEJO" }), row({ id: "icxp_manual", sku: "100017857", source: "manual" })]
    const plan = planCatalogSync(catalog, rows, context)
    expect(plan.toDeactivate.map((r) => r.sku)).toEqual(["VIEJO"])
  })

  it("respeta el límite y no desactiva nada en una corrida parcial", () => {
    const rows = [row({ sku: "VIEJO" })]
    const plan = planCatalogSync(catalog, rows, context, { limit: 5 })
    expect(plan.toCreate.length).toBe(5)
    expect(plan.toDeactivate).toEqual([])
  })

  it("desactiva lo que Intcomex ya no lista", () => {
    const plan = planCatalogSync(catalog, [row({ sku: "VIEJO" })], context)
    expect(plan.toDeactivate.map((r) => r.sku)).toEqual(["VIEJO"])
  })

  it("salta los productos en USD si no hay tipo de cambio", () => {
    const plan = planCatalogSync(catalog, [], { ...context, usdClp: null })
    expect(plan.toCreate.length).toBe(0)
    expect(plan.stats.skippedNoFx).toBeGreaterThan(0)
  })

  it("es idempotente: una segunda pasada sobre filas al día no genera cambios", () => {
    const first = planCatalogSync(catalog, [], context)
    const rows: RowSnapshot[] = first.toCreate.map((p, i) => ({
      id: `icxp_${i}`,
      sku: p.sku,
      cost_net: p.costNet,
      cost_currency: p.currency,
      stock: p.stock,
      category_handle: p.categoryHandle,
      public_price: p.publicPrice,
      medusa_product_id: `prod_${i}`,
      medusa_variant_id: `variant_${i}`,
      inventory_item_id: `iitem_${i}`,
      active: true,
    }))
    const second = planCatalogSync(catalog, rows, context)
    expect(second.toCreate).toEqual([])
    expect(second.changes).toEqual([])
    expect(second.toDeactivate).toEqual([])
  })
})
