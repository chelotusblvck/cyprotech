import { verifyCartLines } from "../checkout/verify"
import type { IntcomexApi, IwsProduct } from "../client/types"
import type { SyncContext } from "../sync/plan"

const context: SyncContext = {
  pricing: { marginPercent: 10, ivaPercent: 19, roundTo: 10, fxBufferPercent: 0, paymentFeePercent: 2.89, minNetMarginPercent: 5 },
  usdClp: 1000,
  minStock: 3,
}

// 100 USD x 1000 x 1,10 x 1,19 = 130.900
const product = (overrides: Partial<IwsProduct> = {}): IwsProduct => ({
  Sku: "S1",
  Description: "Producto",
  Price: { UnitPrice: 100, CurrencyId: "US" },
  InStock: 5,
  ...overrides,
})

const apiWith = (result: IwsProduct | null) =>
  ({ getProduct: jest.fn().mockResolvedValue(result) }) as unknown as IntcomexApi

describe("verifyCartLines", () => {
  it("no reporta problemas cuando hay stock y el precio sigue cubriendo el costo", async () => {
    const issues = await verifyCartLines(apiWith(product()), [{ sku: "S1", quantity: 2, unitPrice: 130900 }], context)
    expect(issues).toEqual([])
  })

  it("reporta producto no disponible", async () => {
    const issues = await verifyCartLines(apiWith(null), [{ sku: "S1", quantity: 1, unitPrice: 130900 }], context)
    expect(issues[0].reason).toBe("unavailable")
  })

  it("reporta stock insuficiente indicando cuántas unidades quedan", async () => {
    const issues = await verifyCartLines(
      apiWith(product({ InStock: 1 })),
      [{ sku: "S1", title: "GPU", quantity: 3, unitPrice: 130900 }],
      context,
    )
    expect(issues[0]).toMatchObject({ reason: "stock", message: "GPU: solo quedan 1 unidades." })
  })

  it("reporta sin stock", async () => {
    const issues = await verifyCartLines(apiWith(product({ InStock: 0 })), [{ sku: "S1", quantity: 1, unitPrice: 130900 }], context)
    expect(issues[0].message).toMatch(/sin stock/)
  })

  it("reporta cuando el costo subió más que la tolerancia", async () => {
    // Costo 110 -> precio actual 143.990; el carrito tiene 130.900 (10% menos).
    const issues = await verifyCartLines(
      apiWith(product({ Price: { UnitPrice: 110, CurrencyId: "US" } })),
      [{ sku: "S1", quantity: 1, unitPrice: 130900 }],
      context,
    )
    expect(issues[0].reason).toBe("price")
  })

  it("tolera diferencias pequeñas y no se alarma si el costo bajó", async () => {
    const small = await verifyCartLines(
      apiWith(product({ Price: { UnitPrice: 101, CurrencyId: "US" } })),
      [{ sku: "S1", quantity: 1, unitPrice: 130900 }],
      context,
    )
    expect(small).toEqual([])

    const cheaper = await verifyCartLines(
      apiWith(product({ Price: { UnitPrice: 80, CurrencyId: "US" } })),
      [{ sku: "S1", quantity: 1, unitPrice: 130900 }],
      context,
    )
    expect(cheaper).toEqual([])
  })
})
