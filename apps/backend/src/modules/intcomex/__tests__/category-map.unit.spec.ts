import { mapCategory } from "../category-map"
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
