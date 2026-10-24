import { SHIPPING_TARIFFS, shippingPriceClp } from "../shipping"

describe("shippingPriceClp", () => {
  it("Santiago: 3 USD mas 1.000 CLP", () => {
    expect(shippingPriceClp(SHIPPING_TARIFFS.santiago, 950)).toBe(3850)
  })

  it("Regiones: 6 USD mas 1.000 CLP", () => {
    expect(shippingPriceClp(SHIPPING_TARIFFS.regiones, 950)).toBe(6700)
  })

  it("redondea hacia arriba a la decena", () => {
    expect(shippingPriceClp(SHIPPING_TARIFFS.santiago, 951.3)).toBe(3860)
  })

  it("rechaza un tipo de cambio invalido", () => {
    expect(() => shippingPriceClp(SHIPPING_TARIFFS.santiago, 0)).toThrow()
    expect(() => shippingPriceClp(SHIPPING_TARIFFS.santiago, NaN)).toThrow()
  })
})
