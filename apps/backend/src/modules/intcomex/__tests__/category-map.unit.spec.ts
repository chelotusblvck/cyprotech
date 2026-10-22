import { DETAIL_CATEGORY, hasPackagingDefect, mapCategory } from "../category-map"
import { MockIntcomexClient } from "../client/mock"
import type { IwsProduct } from "../client/types"

const product = (category: string, description: string): IwsProduct => ({
  Sku: "X",
  Description: description,
  Category: { CategoryId: "x", Description: category, Subcategories: [] },
})

describe("mapCategory", () => {
  it.each([
    ["Tarjetas de Video", "Tarjeta de video ASUS RTX 4070", "tarjetas-de-video"],
    ["Procesadores", "Procesador Intel Core i7", "procesadores"],
    ["Monitores", "Monitor gamer LG 27 QHD 165Hz", "monitores-gamer"],
    ["Monitores", "Monitor Samsung 24 Full HD 75Hz", "monitores"],
    ["Monitores", "Monitor 27 IPS 144Hz", "monitores-gamer"],
    ["Teclados", "Teclado mecánico gamer RGB", "teclados"],
    ["Teclados", "Teclado Logitech K120 USB", "accesorios"],
    ["Mouse", "Mouse gamer inalámbrico 25K DPI", "mouse"],
    ["Mouse", "Mouse inalámbrico M170", "accesorios"],
    ["Cámaras IP", "Cámara IP 4MP exterior", "camaras-ip"],
    ["Grabadores NVR/DVR", "Grabador NVR 8 canales", "grabadores-nvr-dvr"],
    ["Routers", "Router WiFi 6", "routers"],
    ["Switches", "Switch 8 puertos Gigabit", "switches"],
    ["Refrigeración", "Disipador CPU DeepCool", "refrigeracion"],
    ["Accesorios", "Soporte de pared para monitor", "accesorios"],
  ])("%s / %s -> %s", (category, description, expected) => {
    expect(mapCategory(product(category, description))).toBe(expected)
  })

  it.each([
    ["Mouse Pads y Wrist Pads", "Logitech Mousepad Gamer G840 XL Negro"],
    ["Ratones", "Primus Gaming Mouse - PGLC Mouse pad con carga inalambrica"],
    ["Mouse Pads y Wrist Pads", "HyperX Pulsefire Mat Mouse pad - gaming - extra large"],
  ])("un mouse pad va a accesorios aunque sea gamer: %s / %s", (category, description) => {
    expect(mapCategory(product(category, description))).toBe("accesorios")
  })

  it("los SKU de liquidación (-B1) van a la categoría aparte, sea cual sea el producto", () => {
    const base = product("Cajas / Gabinetes", "Xtech Phobos ATX Mid Tower Case Gamer")
    expect(mapCategory({ ...base, Sku: "CS515XTK04" })).toBe("gabinetes")
    expect(mapCategory({ ...base, Sku: "CS515XTK04-B1" })).toBe(DETAIL_CATEGORY.handle)
    expect(mapCategory({ ...base, Sku: "MT862SAM91-b2" })).toBe(DETAIL_CATEGORY.handle)
  })

  it("hasPackagingDefect solo mira el sufijo -B<n>", () => {
    expect(hasPackagingDefect("CP992AMD29-B1")).toBe(true)
    expect(hasPackagingDefect("CP992AMD29")).toBe(false)
    expect(hasPackagingDefect("B1-100017857")).toBe(false)
    expect(hasPackagingDefect("DH120KNG65")).toBe(false)
  })

  it("usa la descripción cuando la categoría no dice nada", () => {
    expect(mapCategory(product("Varios", "Notebook Lenovo 15 pulgadas"))).toBe("notebooks")
  })

  it("devuelve null cuando no reconoce el producto", () => {
    expect(mapCategory(product("Varios", "Pack de etiquetas adhesivas"))).toBeNull()
  })

  it("clasifica el catálogo simulado sin dejar productos físicos sueltos, salvo el caso de prueba", async () => {
    const catalog = await new MockIntcomexClient().getCatalog()
    const physical = catalog.filter((item) => item.Type === "Physical")
    const unmapped = physical.filter((item) => mapCategory(item) === null).map((item) => item.Sku)
    expect(unmapped).toEqual(["MK099ZZ01"])
  })
})
