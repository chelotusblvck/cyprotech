import { calculatePrice, floorMarginPercent, normalizeCurrency } from "../calc"
import { loadPricingConfig } from "../config"
import { fetchUsdClp } from "../fx"

const config = {
  marginPercent: 10, ivaPercent: 19, roundTo: 10, fxBufferPercent: 0,
  paymentFeePercent: 2.89,
  minNetMarginPercent: 5,
}

describe("calculatePrice", () => {
  it("aplica TC, margen sobre costo neto y luego IVA", () => {
    // 100 USD x 950 = 95.000 neto; x1,10 = 104.500; x1,19 = 124.355
    const result = calculatePrice({ costNet: 100, currency: "USD" }, 950, config)
    expect(result.costNetClp).toBe(95000)
    expect(result.netSaleClp).toBe(104500)
    expect(result.publicPriceRaw).toBe(124355)
    expect(result.publicPrice).toBe(124360)
    expect(result.roundingAdjustment).toBe(5)
  })

  it("el margen efectivo con redondeo queda apenas sobre el 10%", () => {
    const result = calculatePrice({ costNet: 100, currency: "USD" }, 950, config)
    expect(result.effectiveMarginPercent).toBeGreaterThanOrEqual(10)
    expect(result.effectiveMarginPercent).toBeLessThan(10.01)
  })

  it("no usa tipo de cambio si el costo ya viene en CLP", () => {
    const result = calculatePrice({ costNet: 50000, currency: "CLP" }, null, config)
    expect(result.fxRate).toBe(1)
    expect(result.publicPrice).toBe(65450)
  })

  it("redondea siempre hacia arriba", () => {
    const result = calculatePrice({ costNet: 1, currency: "USD" }, 951, { ...config, roundTo: 100 })
    expect(result.publicPrice % 100).toBe(0)
    expect(result.publicPrice).toBeGreaterThanOrEqual(result.publicPriceRaw)
  })

  it("suma el colchón al tipo de cambio", () => {
    const result = calculatePrice({ costNet: 100, currency: "USD" }, 1000, {
      ...config,
      fxBufferPercent: 2,
    })
    expect(result.fxRate).toBe(1020)
  })

  it("falla sin tipo de cambio cuando el costo es en USD", () => {
    expect(() => calculatePrice({ costNet: 10, currency: "USD" }, null, config)).toThrow(
      /tipo de cambio/,
    )
  })

  it("rechaza costos inválidos", () => {
    expect(() => calculatePrice({ costNet: -1, currency: "CLP" }, null, config)).toThrow()
    expect(() => calculatePrice({ costNet: NaN, currency: "CLP" }, null, config)).toThrow()
  })
})

describe("normalizeCurrency", () => {
  it.each([
    ["US", "USD"],
    ["USD", "USD"],
    ["CL", "CLP"],
    ["clp", "CLP"],
    [undefined, "USD"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeCurrency(input as string | undefined)).toBe(expected)
  })
})

describe("loadPricingConfig", () => {
  it("usa los valores por defecto del negocio", () => {
    expect(loadPricingConfig({} as NodeJS.ProcessEnv)).toEqual(config)
  })

  it("lee overrides desde el entorno", () => {
    const loaded = loadPricingConfig({
      PRICING_MARGIN_PERCENT: "12.5",
      PRICING_ROUND_TO: "100",
    } as unknown as NodeJS.ProcessEnv)
    expect(loaded.marginPercent).toBe(12.5)
    expect(loaded.roundTo).toBe(100)
  })
})

describe("fetchUsdClp", () => {
  it("toma el valor más reciente de la serie", async () => {
    const quote = await fetchUsdClp(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ serie: [{ fecha: "2026-10-20T03:00:00.000Z", valor: 948.5 }] }),
    }))
    expect(quote).toEqual({ rate: 948.5, date: "2026-10-20", source: "mindicador.cl" })
  })

  it("falla si la respuesta no trae valor", async () => {
    await expect(
      fetchUsdClp(async () => ({ ok: true, status: 200, json: async () => ({ serie: [] }) })),
    ).rejects.toThrow(/válido/)
  })
})

describe("piso de margen", () => {
  it("el recargo minimo para 5% neto tras Flow es ~8,8%", () => {
    expect(floorMarginPercent(config)).toBeGreaterThan(8.7)
    expect(floorMarginPercent(config)).toBeLessThan(8.9)
  })

  it("sube un margen configurado bajo el piso", () => {
    const result = calculatePrice({ costNet: 100, currency: "USD" }, 950, { ...config, marginPercent: 3 })
    expect(result.marginPercent).toBeGreaterThan(8.7)
  })

  it("respeta un margen configurado sobre el piso", () => {
    const result = calculatePrice({ costNet: 100, currency: "USD" }, 950, config)
    expect(result.marginPercent).toBe(10)
  })

  it("el margen neto tras la comision de Flow nunca baja de 5%", () => {
    const result = calculatePrice({ costNet: 100, currency: "USD" }, 950, { ...config, marginPercent: 0 })
    const flowFee = result.publicPrice * 0.0289
    const netAfterFlow = result.publicPrice / 1.19 - flowFee * 1 - result.costNetClp
    expect(netAfterFlow / result.costNetClp).toBeGreaterThanOrEqual(0.05)
  })
})
