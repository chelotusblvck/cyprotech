import type LedgerModuleService from "../service"
import { DEFAULT_SETTINGS } from "../logic"
import {
  addManualEntry,
  closePeriod,
  getSettings,
  markDelivered,
  openPeriodFor,
  payPayout,
  periodSummary,
  recordPlacedOrder,
  releaseDueOrders,
  reverseOrder,
  saveSettings,
} from "../operations"

// Servicio en memoria con la misma forma que el generado por MedusaService para el ledger.
const makeService = () => {
  let seq = 0
  const store: Record<string, Record<string, unknown>[]> = {
    settings: [],
    orders: [],
    entries: [],
    periods: [],
    payouts: [],
  }
  const matches = (row: Record<string, unknown>, filters: Record<string, unknown> = {}) =>
    Object.entries(filters).every(([key, value]) => row[key] === value)

  const crud = (name: string, label: string) => ({
    [`list${label}`]: async (filters?: Record<string, unknown>) => store[name].filter((row) => matches(row, filters)),
    [`create${label}`]: async (data: Record<string, unknown> | Record<string, unknown>[]) => {
      const make = (item: Record<string, unknown>) => {
        const row = { id: `${name}_${++seq}`, created_at: new Date(), ...item }
        store[name].push(row)
        return row
      }
      return Array.isArray(data) ? data.map(make) : make(data)
    },
    [`update${label}`]: async (data: Record<string, unknown>) => {
      const row = store[name].find((item) => item.id === data.id)
      Object.assign(row as object, data)
      return row
    },
  })

  const service = {
    ...crud("settings", "LedgerSettings"),
    ...crud("orders", "LedgerOrders"),
    ...crud("entries", "LedgerEntries"),
    ...crud("periods", "LedgerPeriods"),
    ...crud("payouts", "LedgerPayouts"),
  } as unknown as LedgerModuleService
  return { service, store }
}

// Servicio sin comisión de pasarela: las pruebas que no hablan de comisiones parten de cero.
const makeFree = async () => {
  const made = makeService()
  await saveSettings(made.service, { ...DEFAULT_SETTINGS, gatewayFeePercent: 0 })
  return made
}

const day = (iso: string) => new Date(`${iso}T15:00:00Z`)

const line = { unitNetSale: 110000, costNetClpPerUnit: 100000, quantity: 1 }

const place = (service: LedgerModuleService, id: string, total = 130900) =>
  recordPlacedOrder(service, { orderId: id, displayId: `CY-${id}`, lines: [line], totalPaid: total })

describe("configuración", () => {
  it("crea la configuración por defecto la primera vez", async () => {
    const { service, store } = makeService()
    expect(await getSettings(service)).toEqual(DEFAULT_SETTINGS)
    expect(store.settings).toHaveLength(1)
    await getSettings(service)
    expect(store.settings).toHaveLength(1)
  })

  it("guarda cambios y rechaza porcentajes que no suman 100", async () => {
    const { service } = makeService()
    await saveSettings(service, { ...DEFAULT_SETTINGS, gatewayFeePercent: 3.19 })
    expect((await getSettings(service)).gatewayFeePercent).toBe(3.19)
    await expect(
      saveSettings(service, { ...DEFAULT_SETTINGS, partnerA: { ...DEFAULT_SETTINGS.partnerA, percent: 70 } }),
    ).rejects.toThrow(/sumar 100/)
  })
})

describe("ciclo de un pedido", () => {
  it("registra el pedido una sola vez con su margen y comisión", async () => {
    const { service, store } = makeService()
    await saveSettings(service, { ...DEFAULT_SETTINGS, gatewayFeePercent: 3 })
    await place(service, "o1")
    await place(service, "o1")
    expect(store.orders).toHaveLength(1)
    expect(store.orders[0].economics).toMatchObject({ grossMargin: 10000, gatewayFee: 3927, contribution: 6073 })
  })

  it("no reconoce utilidad hasta que pase el plazo de retracto tras la entrega", async () => {
    const { service, store } = await makeFree()
    await place(service, "o1")
    await markDelivered(service, "o1", day("2026-10-01"))

    expect(await releaseDueOrders(service, day("2026-10-10"))).toBe(0)
    expect(store.entries).toHaveLength(0)

    expect(await releaseDueOrders(service, day("2026-10-12"))).toBe(1)
    expect(store.orders[0]).toMatchObject({ state: "earned", period: "2026-10" })
    expect(store.entries.map((e) => [e.kind, e.amount])).toEqual([["margin", 10000]])
  })

  it("no reconoce pedidos sin entregar", async () => {
    const { service } = makeService()
    await place(service, "o1")
    expect(await releaseDueOrders(service, day("2026-12-01"))).toBe(0)
  })

  it("reconocer dos veces no duplica los asientos", async () => {
    const { service, store } = await makeFree()
    await place(service, "o1")
    await markDelivered(service, "o1", day("2026-10-01"))
    await releaseDueOrders(service, day("2026-10-20"))
    // Simula una falla después de registrar los asientos: el pedido vuelve a pendiente.
    store.orders[0].state = "pending"
    await releaseDueOrders(service, day("2026-10-21"))
    expect(store.entries).toHaveLength(1)
  })

  it("anular un pedido pendiente no genera asientos", async () => {
    const { service, store } = makeService()
    await place(service, "o1")
    await reverseOrder(service, "o1", day("2026-10-05"))
    expect(store.orders[0].state).toBe("void")
    expect(store.entries).toHaveLength(0)
  })

  it("revertir un pedido ya reconocido resta el margen y conserva la comisión", async () => {
    const { service, store } = makeService()
    await saveSettings(service, { ...DEFAULT_SETTINGS, gatewayFeePercent: 3, holdDays: 0 })
    await place(service, "o1")
    await markDelivered(service, "o1", day("2026-10-01"))
    await releaseDueOrders(service, day("2026-10-02"))
    await reverseOrder(service, "o1", day("2026-10-10"))
    await reverseOrder(service, "o1", day("2026-10-11"))

    const kinds = store.entries.map((e) => [e.kind, e.amount])
    expect(kinds).toEqual([
      ["margin", 10000],
      ["gateway_fee", -3927],
      ["reversal", -10000],
    ])
    expect(store.orders[0].state).toBe("reversed")
  })
})

describe("comisión de la pasarela", () => {
  it("la configuración inicial trae la comisión de Flow (2,89%)", async () => {
    const { service } = makeService()
    expect((await getSettings(service)).gatewayFeePercent).toBe(2.89)
  })

  it("usa la comisión real que informó Flow en vez de estimarla", async () => {
    const { service, store } = makeService()
    await recordPlacedOrder(service, {
      orderId: "o1",
      displayId: "CY1",
      lines: [line],
      totalPaid: 130900,
      actualFee: 3500,
    })
    expect(store.orders[0].economics).toMatchObject({ gatewayFee: 3500, feeSource: "flow", contribution: 6500 })
  })

  it("descuenta el IVA de la comisión real cuando Flow la informa con IVA incluido", async () => {
    const { service, store } = makeService()
    await saveSettings(service, { ...DEFAULT_SETTINGS, gatewayFeeReportedWithIva: true })
    await recordPlacedOrder(service, {
      orderId: "o1",
      displayId: "CY1",
      lines: [line],
      totalPaid: 130900,
      actualFee: 1190,
      ivaPercent: 19,
    })
    expect(store.orders[0].economics).toMatchObject({ gatewayFee: 1000, feeSource: "flow" })
  })

  it("estima con el porcentaje si no hay comisión real", async () => {
    const { service, store } = makeService()
    await recordPlacedOrder(service, { orderId: "o1", displayId: "CY1", lines: [line], totalPaid: 100000 })
    expect(store.orders[0].economics).toMatchObject({ gatewayFee: 2890, feeSource: "estimate" })
  })
})

describe("períodos y cierre", () => {
  it("un asiento nunca cae en un mes cerrado", async () => {
    const { service } = makeService()
    await addManualEntry(service, { kind: "expense", amount: 100, description: "x", period: "2026-09" })
    await closePeriod(service, "2026-09", { now: day("2026-10-02") })
    expect(await openPeriodFor(service, day("2026-09-20"))).toBe("2026-10")
  })

  it("no deja cerrar el mes en curso sin forzar", async () => {
    const { service } = makeService()
    await expect(closePeriod(service, "2026-10", { now: day("2026-10-15") })).rejects.toThrow(/todavía no termina/)
    await expect(closePeriod(service, "2026-10", { now: day("2026-10-15"), force: true })).resolves.toBeDefined()
  })

  it("exige cerrar los meses anteriores primero", async () => {
    const { service } = makeService()
    await addManualEntry(service, { kind: "expense", amount: 100, description: "a", period: "2026-08" })
    await addManualEntry(service, { kind: "expense", amount: 100, description: "b", period: "2026-09" })
    await expect(closePeriod(service, "2026-09", { now: day("2026-11-01") })).rejects.toThrow(/Cierra primero el período 2026-08/)
  })

  it("registra los costos fijos al cerrar y reparte la utilidad 50/50", async () => {
    const { service, store } = await makeFree()
    await place(service, "o1")
    await markDelivered(service, "o1", day("2026-09-01"))
    await releaseDueOrders(service, day("2026-09-20"))

    const result = await closePeriod(service, "2026-09", { now: day("2026-10-02") })
    // margen 10.000 - facturador 9.990 = 10
    expect(result.totals.netProfit).toBe(10)
    expect(store.entries.some((e) => e.source === "recurring:OpenFactura (Haulmer)")).toBe(true)
    expect(result.payouts.map((p) => p.amount)).toEqual([5, 5])
  })

  it("una pérdida se arrastra y se recupera el mes siguiente antes de repartir", async () => {
    const { service } = makeService()
    // Septiembre: solo gasto de 20.000 + facturador 9.990 => pérdida 29.990.
    await addManualEntry(service, { kind: "expense", amount: 20000, description: "Hosting", period: "2026-09" })
    const sep = await closePeriod(service, "2026-09", { now: day("2026-10-02") })
    expect(sep.totals.deficitOut).toBe(29990)
    expect(sep.payouts).toHaveLength(0)

    // Octubre: margen 100.000 menos facturador 9.990 = 90.010; se recuperan 29.990.
    await addManualEntry(service, { kind: "adjustment", amount: 100000, description: "Margen", period: "2026-10" })
    const oct = await closePeriod(service, "2026-10", { now: day("2026-11-02") })
    expect(oct.totals.deficitIn).toBe(29990)
    expect(oct.totals.distributable).toBe(60020)
    expect(oct.payouts.map((p) => p.amount)).toEqual([30010, 30010])
  })

  it("no permite registrar movimientos en un mes cerrado", async () => {
    const { service } = makeService()
    await addManualEntry(service, { kind: "expense", amount: 100, description: "a", period: "2026-09" })
    await closePeriod(service, "2026-09", { now: day("2026-10-02") })
    await expect(
      addManualEntry(service, { kind: "expense", amount: 50, description: "b", period: "2026-09" }),
    ).rejects.toThrow(/cerrado/)
  })

  it("un gasto se registra restando y un ajuste respeta su signo", async () => {
    const { service } = makeService()
    const expense = await addManualEntry(service, { kind: "expense", amount: 500, description: "Hosting", period: "2026-09" })
    const adjustment = await addManualEntry(service, { kind: "adjustment", amount: -200, description: "Corrección", period: "2026-09" })
    expect(expense.amount).toBe(-500)
    expect(adjustment.amount).toBe(-200)
  })
})

describe("pagos y resumen", () => {
  it("marca un pago como pagado una sola vez", async () => {
    const { service, store } = makeService()
    await addManualEntry(service, { kind: "adjustment", amount: 100000, description: "Margen", period: "2026-09" })
    await closePeriod(service, "2026-09", { now: day("2026-10-02") })
    const payoutId = store.payouts[0].id as string

    const paid = await payPayout(service, payoutId, " TRF-1 ", day("2026-10-05"))
    expect(paid).toMatchObject({ status: "paid", reference: "TRF-1" })
    await expect(payPayout(service, payoutId, null)).rejects.toThrow(/ya está marcado/)
    await expect(payPayout(service, "nope", null)).rejects.toThrow(/No existe/)
  })

  it("el resumen de un mes abierto proyecta los costos fijos pendientes", async () => {
    const { service } = makeService()
    await addManualEntry(service, { kind: "adjustment", amount: 50000, description: "Margen" }, day("2026-10-10"))
    const summary = await periodSummary(service, "2026-10", day("2026-10-15"))
    expect(summary.status).toBe("open")
    expect(summary.projectedFixedCosts).toHaveLength(1)
    expect(summary.totals).toMatchObject({ netProfit: 40010 })
    expect(summary.payouts.map((p) => p.amount)).toEqual([20005, 20005])
  })

  it("avisa si la comisión de la pasarela no está configurada", async () => {
    const { service } = await makeFree()
    expect((await periodSummary(service, "2026-10")).gatewayFeeConfigured).toBe(false)
    await saveSettings(service, { ...DEFAULT_SETTINGS, gatewayFeePercent: 3 })
    expect((await periodSummary(service, "2026-10")).gatewayFeeConfigured).toBe(true)
  })
})
