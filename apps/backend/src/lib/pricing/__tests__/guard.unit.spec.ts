import { checkPriceChange, describeHeld, loadPriceGuard } from "../guard"

const guard = { maxDropPercent: 30, maxRisePercent: 60 }

describe("loadPriceGuard", () => {
  it("usa 30 % de baja y 60 % de alza por defecto", () => {
    expect(loadPriceGuard({} as NodeJS.ProcessEnv)).toEqual({ maxDropPercent: 30, maxRisePercent: 60 })
  })

  it("lee los límites del entorno e ignora valores inválidos", () => {
    expect(loadPriceGuard({ PRICING_MAX_DROP_PERCENT: "20", PRICING_MAX_RISE_PERCENT: "100" } as unknown as NodeJS.ProcessEnv)).toEqual({
      maxDropPercent: 20,
      maxRisePercent: 100,
    })
    expect(loadPriceGuard({ PRICING_MAX_DROP_PERCENT: "abc", PRICING_MAX_RISE_PERCENT: "-5" } as unknown as NodeJS.ProcessEnv)).toEqual({
      maxDropPercent: 30,
      maxRisePercent: 60,
    })
  })
})

describe("checkPriceChange", () => {
  it("deja pasar los cambios normales", () => {
    expect(checkPriceChange("S1", 100000, 95000, guard)).toBeNull()
    expect(checkPriceChange("S1", 100000, 120000, guard)).toBeNull()
  })

  it("retiene una baja de 30 % o más (el límite mismo ya se retiene)", () => {
    expect(checkPriceChange("S1", 100000, 71000, guard)).toBeNull()
    expect(checkPriceChange("S1", 100000, 70000, guard)).toMatchObject({ reason: "drop", changePercent: -30 })
    expect(checkPriceChange("S1", 124360, 12436, guard)).toMatchObject({ reason: "drop", from: 124360, to: 12436, changePercent: -90 })
  })

  it("retiene un alza de 60 % o más", () => {
    expect(checkPriceChange("S1", 100000, 159000, guard)).toBeNull()
    expect(checkPriceChange("S1", 100000, 160000, guard)).toMatchObject({ reason: "rise", changePercent: 60 })
  })

  it("sin precio publicado no hay con qué comparar: no retiene", () => {
    expect(checkPriceChange("S1", null, 1, guard)).toBeNull()
    expect(checkPriceChange("S1", 0, 1, guard)).toBeNull()
  })
})

describe("describeHeld", () => {
  const held = [
    { sku: "A", from: 10000, to: 5000, changePercent: -50, reason: "drop" as const },
    { sku: "B", from: 10000, to: 18000, changePercent: 80, reason: "rise" as const },
  ]

  it("resume cada cambio con su porcentaje", () => {
    expect(describeHeld(held)).toBe("A 10000 -> 5000 (-50 %); B 10000 -> 18000 (+80 %)")
  })

  it("corta la lista y dice cuántos más hay", () => {
    expect(describeHeld(held, 1)).toBe("A 10000 -> 5000 (-50 %); y 1 más")
  })
})
