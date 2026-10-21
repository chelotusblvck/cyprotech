import { mapCategory } from "../category-map"
import {
  detailUrl,
  ExtractionError,
  normalizeProductPage,
  parsePrice,
  parseStock,
  pickImages,
  productIdFromUrl,
  type RawProductPage,
} from "../manual/normalize"

// Texto real de https://store.intcomex.com/es-XCL/Product/Detail/507131
const kingston: RawProductPage = {
  url: "https://store.intcomex.com/es-XCL/Product/Detail/507131",
  productId: "507131",
  boxText:
    "Kingston Fury Memoria RAM 8GB 3200MT/S DDR4 DIMM RGB\nKingston Fury\n8 GB\nDIMM de 288 contactos\n3200 MT/s / PC4-25600\nCL16\n1.35 V\nsin búfer\nno ECC\nnegro\nIntcomex SKU:\n \n100017857\n  \n \nNúmero de parte:\n \nKF432C16BB2A/8\n         \nSin Calificación.\n\n",
  priceText: "$ 108.34",
  stockText: "18 en inventario",
  breadcrumb: [
    { href: "/es-XCL/Home?r=True", text: "Inicio" },
    { href: "/es-XCL/Products/Category/mem?r=True", text: "Memorias" },
    { href: "/es-XCL/Products/ByCategory/mem.dramgen?r=True", text: "Módulos RAM - Genéricos" },
  ],
  descriptionText: "Descripción del producto\nKingston FURY Beast RGB ofrece un impulso de rendimiento.",
  imageUrls: [
    "https://store.intcomex.com/images/products/100017857m.jpg?v=1",
    "https://store.intcomex.com/images/products/100017857xl.jpg",
    "https://store.intcomex.com/images/products/KVR32S22S88-200.jpg",
  ],
}

describe("parsePrice", () => {
  it("lee precios con punto decimal y coma de miles", () => {
    expect(parsePrice("$ 108.34")).toBe(108.34)
    expect(parsePrice("US$ 1,234.50")).toBe(1234.5)
  })

  it("acepta coma decimal", () => {
    expect(parsePrice("1.234,50")).toBe(1234.5)
  })

  it("devuelve null si no hay precio", () => {
    expect(parsePrice("")).toBeNull()
    expect(parsePrice("Consultar")).toBeNull()
  })
})

describe("parseStock", () => {
  it("extrae la cantidad", () => {
    expect(parseStock("18 en inventario")).toBe(18)
    expect(parseStock("1,250 en inventario")).toBe(1250)
  })

  it("devuelve null si no hay cantidad", () => {
    expect(parseStock(null)).toBeNull()
    expect(parseStock("Sin stock")).toBeNull()
  })
})

describe("urls", () => {
  it("arma la URL a partir del id y la deja igual si ya es URL", () => {
    expect(detailUrl("507131")).toBe("https://store.intcomex.com/es-XCL/Product/Detail/507131")
    expect(detailUrl(" https://store.intcomex.com/es-XCL/Product/Detail/1 ")).toBe(
      "https://store.intcomex.com/es-XCL/Product/Detail/1",
    )
  })

  it("saca el id del producto", () => {
    expect(productIdFromUrl("https://store.intcomex.com/es-XCL/Product/Detail/507131#x")).toBe("507131")
    expect(productIdFromUrl("https://store.intcomex.com/es-XCL/Home")).toBeNull()
  })
})

describe("pickImages", () => {
  it("prefiere la versión grande, sin duplicados y sin imágenes de otros productos", () => {
    expect(pickImages("100017857", kingston.imageUrls)).toEqual([
      "https://store.intcomex.com/images/products/100017857xl.jpg",
    ])
  })

  it("usa la imagen por defecto del SKU si no encuentra ninguna", () => {
    expect(pickImages("100017857", [])).toEqual(["https://store.intcomex.com/images/products/100017857xl.jpg"])
  })

  it("completa rutas relativas", () => {
    expect(pickImages("1", ["/images/products/1m.png"])).toEqual(["https://store.intcomex.com/images/products/1xl.png"])
  })
})

describe("normalizeProductPage", () => {
  const { product, details, imageUrls, sourceUrl } = normalizeProductPage(kingston)

  it("lee identificadores, título y marca", () => {
    expect(product.Sku).toBe("100017857")
    expect(product.Mpn).toBe("KF432C16BB2A/8")
    expect(product.Description).toBe("Kingston Fury Memoria RAM 8GB 3200MT/S DDR4 DIMM RGB")
    expect(product.Brand?.Description).toBe("Kingston Fury")
    expect(sourceUrl).toBe(kingston.url)
  })

  it("el costo es neto, en dólares, y trae el stock", () => {
    expect(product.Price).toEqual({ UnitPrice: 108.34, CurrencyId: "USD" })
    expect(product.InStock).toBe(18)
    expect(product.Type).toBe("Physical")
  })

  it("la categoría sale del breadcrumb y el mapeo la reconoce", () => {
    expect(product.Category?.CategoryId).toBe("mem")
    expect(product.Category?.Subcategories?.[0]).toMatchObject({ CategoryId: "mem.dramgen" })
    expect(mapCategory(product)).toBe("memoria-ram")
  })

  it("arma la ficha con las viñetas y la descripción sin el encabezado", () => {
    expect(details).toContain("- 8 GB")
    expect(details).toContain("- DIMM de 288 contactos")
    expect(details).toContain("Kingston FURY Beast RGB ofrece")
    expect(details).not.toContain("Descripción del producto")
    expect(imageUrls).toEqual(["https://store.intcomex.com/images/products/100017857xl.jpg"])
  })

  it("sin línea de marca, todo lo que sigue al título son viñetas", () => {
    const noBrand = normalizeProductPage({
      ...kingston,
      boxText: "Cable HDMI 2 m\n2 metros\nnegro\nIntcomex SKU:\n77\nNúmero de parte:\nCB-1",
    })
    expect(noBrand.product.Brand).toBeUndefined()
    expect(noBrand.details).toContain("- 2 metros")
    expect(noBrand.product.Sku).toBe("77")
  })

  it("sin stock legible deja el stock sin definir", () => {
    expect(normalizeProductPage({ ...kingston, stockText: null }).product.InStock).toBeUndefined()
  })

  it("falla con un mensaje claro si falta el SKU o el precio", () => {
    expect(() => normalizeProductPage({ ...kingston, boxText: "" })).toThrow(ExtractionError)
    expect(() => normalizeProductPage({ ...kingston, priceText: "" })).toThrow(/precio/)
  })
})
