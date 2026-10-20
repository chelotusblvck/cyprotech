import {
  actualGatewayFee,
  buildIwsOrder,
  buildSnapshots,
  customerOrderNumber,
  type OrderForIntcomex,
} from "../orders/build-order"

const pricing = { marginPercent: 10, ivaPercent: 19, roundTo: 10, fxBufferPercent: 0 }

const order: OrderForIntcomex = {
  id: "order_01ABC",
  display_id: 1042,
  email: "cliente@example.com",
  currency_code: "clp",
  total: 372000,
  metadata: { rut: "12.345.678-5" },
  items: [
    { id: "item_1", title: "Tarjeta de video", quantity: 1, unit_price: 371960, variant_sku: "MK001GPU02" },
    { id: "item_2", title: "Sin sku", quantity: 1, unit_price: 1000, variant_sku: null },
  ],
  shipping_address: {
    first_name: "Ana",
    last_name: "Pérez",
    address_1: "Av. Providencia 1234",
    address_2: "Depto 56",
    city: "Providencia",
    province: "cl-rm",
    postal_code: "7500000",
    country_code: "cl",
    phone: "+56912345678",
  },
  shipping_methods: [{ name: "Despacho Santiago", amount: 2900 }],
}

describe("customerOrderNumber", () => {
  it("usa el display id sin caracteres especiales", () => {
    expect(customerOrderNumber(order)).toBe("CY1042")
  })
  it("cae al id del pedido si no hay display id", () => {
    expect(customerOrderNumber({ id: "order_01-ABC", display_id: null })).toBe("CYorder01ABC")
  })
})

describe("buildIwsOrder", () => {
  it("arma la orden con despacho directo al cliente final", () => {
    const result = buildIwsOrder(order)
    expect(result.CustomerOrderNumber).toBe("CY1042")
    expect(result.Items).toEqual([{ Sku: "MK001GPU02", Quantity: 1, StoreItemId: "item_1" }])
    expect(result.StoreOrder?.Shipping).toMatchObject({
      FirstName: "Ana",
      LastName: "Pérez",
      Address: "Av. Providencia 1234",
      SuiteNumber: "Depto 56",
      City: "Providencia",
      State: "Región Metropolitana de Santiago",
      StateId: "CL-RM",
      CountryId: "CL",
      Cellphone: "+56912345678",
      Email: "cliente@example.com",
      DocumentId: "12.345.678-5",
    })
    expect(result.StoreOrder?.DeliveryType).toBe("Despacho Santiago")
  })

  it("no informa flete mientras no esté confirmado el formato", () => {
    expect(buildIwsOrder(order).Shipments).toBeUndefined()
    expect(buildIwsOrder(order, { shipmentServiceType: "Standard", shipmentAmount: 3 }).Shipments).toEqual([
      { ServiceType: "Standard", Amount: 3 },
    ])
  })

  it("falla sin productos de Intcomex o sin dirección", () => {
    expect(() => buildIwsOrder({ ...order, items: [] })).toThrow(/SKU/)
    expect(() => buildIwsOrder({ ...order, shipping_address: null })).toThrow(/dirección/)
  })
})

describe("buildSnapshots", () => {
  it("calcula costo en CLP y margen neto por línea", () => {
    const [line] = buildSnapshots(order, [{ sku: "MK001GPU02", cost_net: 289.4, cost_currency: "USD" }], 981.86, pricing)
    // costo = 289,4 x 981,86 = 284.150,2 ; neto de venta = 371.960 / 1,19 = 312.571,4
    expect(line.costNetClpPerUnit).toBeCloseTo(284150.2, 0)
    expect(line.unitNetSale).toBeCloseTo(312571.43, 1)
    expect(line.marginClp).toBeCloseTo(28421.2, 0)
    expect(line.costSource).toBe("catalog")
  })

  it("omite las líneas que no son de Intcomex", () => {
    expect(buildSnapshots(order, [], 981.86, pricing)).toEqual([])
  })
})

describe("actualGatewayFee", () => {
  it("suma la comisión que informó cada pago", () => {
    expect(
      actualGatewayFee({
        payment_collections: [{ payments: [{ data: { flowFee: 1000 } }, { data: { flowFee: 250 } }] }],
      }),
    ).toBe(1250)
  })

  it("devuelve null si no hay pagos o alguno no trae la comisión", () => {
    expect(actualGatewayFee({})).toBeNull()
    expect(actualGatewayFee({ payment_collections: [{ payments: [] }] })).toBeNull()
    expect(actualGatewayFee({ payment_collections: [{ payments: [{ data: { flowFee: 100 } }, { data: {} }] }] })).toBeNull()
    expect(actualGatewayFee({ payment_collections: [{ payments: [{ data: { flowFee: "100" } }] }] })).toBeNull()
  })
})
