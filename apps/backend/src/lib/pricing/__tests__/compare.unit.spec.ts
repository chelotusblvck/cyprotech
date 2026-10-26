import {
  floorPublicPrice,
  marginAfterFee,
  matchesPartNumber,
  median,
  searchTerms,
  suggestPrice,
} from "../compare"

describe("matchesPartNumber", () => {
  it("cruza con separadores distintos", () => {
    expect(matchesPartNumber("910-005550", "Mouse Logitech G502 HERO - SKU: 910-005550")).toBe(true)
    expect(matchesPartNumber("910-007818", "Mouse G502 X PLUS (910-007818) RGB")).toBe(true)
    expect(matchesPartNumber("910-005550", "SKU 910005550")).toBe(true)
  })

  it("no cruza por prefijos ni por numeros de parte cortos", () => {
    expect(matchesPartNumber("910-00555", "SKU: 910-005550")).toBe(false)
    expect(matchesPartNumber("A400", "SSD Kingston A400 480GB")).toBe(false)
    expect(matchesPartNumber(null, "cualquier cosa")).toBe(false)
  })
})

describe("median", () => {
  it("maneja vacio, impar y par", () => {
    expect(median([])).toBeNull()
    expect(median([30, 10, 20])).toBe(20)
    expect(median([10, 20, 30, 41])).toBe(25)
  })
})

describe("margen y piso", () => {
  const config = { ivaPercent: 19, paymentFeePercent: 2.89, minNetMarginPercent: 5, roundTo: 10 }

  it("el precio piso deja al menos 5% neto tras la comision", () => {
    const costNetClp = 100000
    const floor = floorPublicPrice(costNetClp, config)
    expect(marginAfterFee({ publicPrice: floor, costNetClp, ...config })).toBeGreaterThanOrEqual(5)
    expect(marginAfterFee({ publicPrice: floor - 100, costNetClp, ...config })).toBeLessThan(5)
  })

  it("coincide con el precio que calcula calculatePrice con margen minimo", () => {
    // 100.000 neto: piso ~ 100000 x 1,05 / (1/1,19 - 0,0289)
    expect(floorPublicPrice(100000, config)).toBeGreaterThan(129000)
    expect(floorPublicPrice(100000, config)).toBeLessThan(131000)
  })
})

describe("suggestPrice", () => {
  it("nunca baja del piso", () => {
    expect(suggestPrice(130000, 120000, 1, 10)).toEqual({ suggested: 130000, belowFloor: true })
  })

  it("usa la mediana menos el descuento cuando supera el piso", () => {
    expect(suggestPrice(130000, 150000, 1, 10)).toEqual({ suggested: 148500, belowFloor: false })
  })

  it("sin mercado no sugiere nada", () => {
    expect(suggestPrice(130000, null, 1, 10)).toEqual({ suggested: null, belowFloor: false })
  })
})

describe("searchTerms", () => {
  it("usa el numero de parte y luego el modelo del titulo", () => {
    expect(searchTerms("Logitech Teclado Gamer G915 X TKL Lightspeed Blanco Ingles", "920-012732")).toEqual([
      "920-012732",
      "G915",
    ])
  })

  it("ignora medidas y estandares", () => {
    expect(searchTerms("Kingston Fury Memoria RAM 8GB 3200MHZ DDR4 DIMM", "KF432C16BB/8")).toEqual(["KF432C16BB/8"])
  })

  it("sin numero de parte usable solo busca por modelo", () => {
    expect(searchTerms("Logitech Mouse Gamer G502 X Plus", "N/A")).toEqual(["G502"])
  })
})
