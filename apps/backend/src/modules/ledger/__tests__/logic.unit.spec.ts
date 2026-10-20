import {
  DEFAULT_SETTINGS,
  computeClose,
  earnedEntries,
  isValidPeriod,
  nextPeriod,
  orderEconomics,
  pendingFixedCosts,
  periodOf,
  reversalEntries,
  sumEntries,
  toCsv,
  validateSettings,
  type LedgerSettingsData,
} from "../logic"

const settings: LedgerSettingsData = {
  ...DEFAULT_SETTINGS,
  gatewayFeePercent: 3,
  gatewayFeeFixed: 0,
  fixedCosts: [
    { name: "OpenFactura", amount: 9990 },
    { name: "Hosting", amount: 15000 },
  ],
}

describe("orderEconomics", () => {
  const lines = [
    { unitNetSale: 312571.43, costNetClpPerUnit: 284150.28, quantity: 1 },
    { unitNetSale: 107899.16, costNetClpPerUnit: 98087.81, quantity: 2 },
  ]

  it("suma ingreso y costo netos y descuenta la comisión de la pasarela", () => {
    const result = orderEconomics(lines, 540000, settings)
    expect(result.revenueNet).toBe(528369.75)
    expect(result.costNet).toBe(480325.9)
    expect(result.grossMargin).toBe(48043.85)
    expect(result.gatewayFee).toBe(16200)
    expect(result.contribution).toBe(31843.85)
  })

  it("agrega el cargo fijo por transacción", () => {
    const result = orderEconomics(lines, 100000, { gatewayFeePercent: 2, gatewayFeeFixed: 150 })
    expect(result.gatewayFee).toBe(2150)
  })

  it("permite contribución negativa", () => {
    const result = orderEconomics([{ unitNetSale: 1000, costNetClpPerUnit: 990, quantity: 1 }], 1190, {
      gatewayFeePercent: 5,
      gatewayFeeFixed: 0,
    })
    expect(result.contribution).toBeLessThan(0)
  })
})

describe("asientos", () => {
  const economics = orderEconomics([{ unitNetSale: 1100, costNetClpPerUnit: 1000, quantity: 10 }], 13090, settings)

  it("al reconocer el pedido registra margen y comisión", () => {
    const entries = earnedEntries("order_1", "CY1", economics)
    expect(entries.map((e) => [e.kind, e.amount])).toEqual([
      ["margin", 1000],
      ["gateway_fee", -392.7],
    ])
  })

  it("sin comisión no genera asiento de comisión", () => {
    const free = orderEconomics([{ unitNetSale: 1100, costNetClpPerUnit: 1000, quantity: 10 }], 13090, {
      gatewayFeePercent: 0,
      gatewayFeeFixed: 0,
    })
    expect(earnedEntries("order_1", "CY1", free)).toHaveLength(1)
  })

  it("la reversa devuelve el margen pero no la comisión", () => {
    const entries = reversalEntries("order_1", "CY1", economics)
    expect(entries).toEqual([
      expect.objectContaining({ kind: "reversal", amount: -1000 }),
    ])
  })
})

describe("pendingFixedCosts", () => {
  it("registra cada costo fijo una sola vez por período", () => {
    expect(pendingFixedCosts("2026-10", settings, []).map((e) => [e.description, e.amount])).toEqual([
      ["OpenFactura (2026-10)", -9990],
      ["Hosting (2026-10)", -15000],
    ])
    const again = pendingFixedCosts("2026-10", settings, ["recurring:OpenFactura"])
    expect(again.map((e) => e.source)).toEqual(["recurring:Hosting"])
  })

  it("ignora costos en cero", () => {
    expect(pendingFixedCosts("2026-10", { fixedCosts: [{ name: "X", amount: 0 }] }, [])).toEqual([])
  })
})

describe("computeClose", () => {
  const entries = [
    { kind: "margin" as const, amount: 200000 },
    { kind: "gateway_fee" as const, amount: -30000 },
    { kind: "expense" as const, amount: -9990 },
    { kind: "expense" as const, amount: -15000 },
    { kind: "reversal" as const, amount: -5000 },
  ]

  it("reparte la utilidad neta 50/50 después de comisiones y costos fijos", () => {
    const { totals, payouts } = computeClose(entries, settings)
    expect(totals.netProfit).toBe(140010)
    expect(totals.distributable).toBe(140010)
    expect(payouts.map((p) => [p.name, p.amount])).toEqual([
      ["Garage360", 70005],
      ["2Pro", 70005],
    ])
  })

  it("el reparto siempre suma la utilidad aunque haya redondeo", () => {
    const { payouts, totals } = computeClose([{ kind: "margin", amount: 100.01 }], settings)
    expect(payouts[0].amount + payouts[1].amount).toBeCloseTo(totals.distributable, 2)
  })

  it("respeta porcentajes distintos de 50/50", () => {
    const custom = { ...settings, partnerA: { ...settings.partnerA, percent: 60 }, partnerB: { ...settings.partnerB, percent: 40 } }
    const { payouts } = computeClose([{ kind: "margin", amount: 1000 }], custom)
    expect(payouts.map((p) => p.amount)).toEqual([600, 400])
  })

  it("una pérdida no se paga y se arrastra al período siguiente", () => {
    const { totals, payouts } = computeClose([{ kind: "margin", amount: 5000 }, { kind: "expense", amount: -25000 }], settings)
    expect(totals.netProfit).toBe(-20000)
    expect(totals.distributable).toBe(0)
    expect(totals.deficitOut).toBe(20000)
    expect(payouts.map((p) => p.amount)).toEqual([0, 0])
  })

  it("la pérdida anterior se recupera antes de repartir", () => {
    const { totals, payouts } = computeClose([{ kind: "margin", amount: 50000 }], settings, 20000)
    expect(totals.deficitIn).toBe(20000)
    expect(totals.distributable).toBe(30000)
    expect(payouts.map((p) => p.amount)).toEqual([15000, 15000])
  })

  it("sin arrastre de pérdidas ignora el déficit previo", () => {
    const { totals } = computeClose([{ kind: "margin", amount: 50000 }], { ...settings, carryDeficit: false }, 20000)
    expect(totals.distributable).toBe(50000)
    expect(totals.deficitOut).toBe(0)
  })

  it("una pérdida sin arrastre simplemente no paga", () => {
    const { totals } = computeClose([{ kind: "expense", amount: -100 }], { ...settings, carryDeficit: false })
    expect(totals.distributable).toBe(0)
    expect(totals.deficitOut).toBe(0)
  })
})

describe("validateSettings", () => {
  it("exige que los socios sumen 100", () => {
    expect(() =>
      validateSettings({ ...settings, partnerA: { ...settings.partnerA, percent: 60 } }),
    ).toThrow(/sumar 100/)
  })
  it("rechaza comisiones negativas o de 100%", () => {
    expect(() => validateSettings({ ...settings, gatewayFeePercent: -1 })).toThrow()
    expect(() => validateSettings({ ...settings, gatewayFeePercent: 100 })).toThrow()
  })
})

describe("períodos", () => {
  it("usa el mes en hora de Chile", () => {
    // 1 nov 02:00 UTC sigue siendo 31 oct en Chile (UTC-3 en verano, UTC-4 en invierno).
    expect(periodOf(new Date("2026-11-01T02:00:00Z"))).toBe("2026-10")
    expect(periodOf(new Date("2026-11-01T12:00:00Z"))).toBe("2026-11")
  })
  it("avanza el período y cruza el año", () => {
    expect(nextPeriod("2026-10")).toBe("2026-11")
    expect(nextPeriod("2026-12")).toBe("2027-01")
  })
  it("valida el formato", () => {
    expect(isValidPeriod("2026-10")).toBe(true)
    expect(isValidPeriod("2026-13")).toBe(false)
    expect(isValidPeriod("26-10")).toBe(false)
  })
})

describe("sumEntries / toCsv", () => {
  it("agrupa por tipo", () => {
    const sums = sumEntries([
      { kind: "margin", amount: 100 },
      { kind: "margin", amount: 50 },
      { kind: "expense", amount: -30 },
    ])
    expect(sums).toMatchObject({ grossMargin: 150, expenses: -30, netProfit: 120 })
  })
  it("escapa comas y comillas en el CSV", () => {
    expect(toCsv([["a", 'b,"c"', 1]])).toBe('a,"b,""c""",1')
  })
})
