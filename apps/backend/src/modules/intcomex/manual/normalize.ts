import type { IwsCategory, IwsProduct } from "../client/types"

// Carga manual de productos desde store.intcomex.com (mientras no hay acceso a la API IWS).
// El extractor (scripts/extract-intcomex-urls.ts) lee la página con la sesión iniciada y entrega
// textos crudos; aquí se convierten a la misma forma que la API (IwsProduct) para reutilizar el
// planificador de sincronización y la creación de productos.

export const STORE_ORIGIN = "https://store.intcomex.com"

export type RawBreadcrumbLink = { href: string | null; text: string }

// Lo que el extractor lee de la página de detalle, sin interpretar.
export type RawProductPage = {
  url: string
  productId: string
  // Texto del bloque principal: título, marca, viñetas, "Intcomex SKU:" y "Número de parte:".
  boxText: string
  priceText: string
  stockText: string | null
  breadcrumb: RawBreadcrumbLink[]
  descriptionText: string
  imageUrls: string[]
}

// Producto ya interpretado, listo para guardar en el JSON que lee el importador.
export type ManualProduct = {
  sourceUrl: string
  product: IwsProduct
  // Viñetas y descripción larga de la ficha, como texto plano.
  details: string
  imageUrls: string[]
}

export const productIdFromUrl = (url: string) => /\/Product\/Detail\/(\d+)/i.exec(url)?.[1] ?? null

export const detailUrl = (idOrUrl: string) => {
  const trimmed = idOrUrl.trim()
  if (/^\d+$/.test(trimmed)) {
    return `${STORE_ORIGIN}/es-XCL/Product/Detail/${trimmed}`
  }
  return trimmed
}

// "$ 108.34" -> 108.34. Los precios de la tienda vienen con punto decimal y coma de miles.
export const parsePrice = (text: string): number | null => {
  const cleaned = text.replace(/[^\d.,]/g, "")
  if (!cleaned) {
    return null
  }
  const lastComma = cleaned.lastIndexOf(",")
  const lastDot = cleaned.lastIndexOf(".")
  const decimalIsComma = lastComma > lastDot && cleaned.length - lastComma - 1 <= 2
  const normalized = decimalIsComma
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/,/g, "")
  const value = Number(normalized)
  return Number.isFinite(value) && value > 0 ? value : null
}

// "18 en inventario" -> 18
export const parseStock = (text: string | null): number | null => {
  const match = text ? /(\d[\d.,]*)/.exec(text) : null
  if (!match) {
    return null
  }
  const value = Number(match[1].replace(/[.,]/g, ""))
  return Number.isFinite(value) ? value : null
}

const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)

// El SKU y el número de parte vienen en líneas separadas: "Intcomex SKU:" / "100017857".
const valueAfter = (all: string[], label: RegExp): string | null => {
  const index = all.findIndex((line) => label.test(line))
  if (index === -1) {
    return null
  }
  const inline = all[index].replace(label, "").trim()
  return inline || all[index + 1]?.trim() || null
}

// Breadcrumb "Inicio / Memorias / Módulos RAM - Genéricos" con enlaces /Products/ByCategory/mem.dramgen
const buildCategory = (breadcrumb: RawBreadcrumbLink[]): IwsCategory | undefined => {
  const steps = breadcrumb
    .filter((link) => link.text && !/\/Home\b/i.test(link.href ?? ""))
    .map((link) => ({
      CategoryId: /\/Products\/(?:By)?Category\/([^?/#]+)/i.exec(link.href ?? "")?.[1] ?? link.text,
      Description: link.text,
    }))
  if (steps.length === 0) {
    return undefined
  }
  return steps.reduceRight<IwsCategory | undefined>(
    (child, step) => ({ ...step, Subcategories: child ? [child] : undefined }),
    undefined,
  )
}

// Imágenes de la galería del producto, tal como las muestra la página: unas vienen del CDN de contenido
// de fabricantes y otras de /images/products/ con nombres sin patrón, así que no se adivinan. Si la tienda
// ofrece la miniatura ("...m.jpg") y la versión grande ("...xl.jpg"), se queda solo la grande.
export const pickImages = (candidates: string[], origin = STORE_ORIGIN): string[] => {
  const urls: string[] = []
  for (const candidate of candidates) {
    const clean = candidate.split("?")[0].trim()
    if (!clean || /\/Image\/Brand|assets-manager|icono_/i.test(clean)) {
      continue
    }
    const absolute = /^https?:\/\//i.test(clean) ? clean : `${origin}${clean.startsWith("/") ? "" : "/"}${clean}`
    const encoded = absolute.replace(/ /g, "%20")
    if (!urls.includes(encoded)) {
      urls.push(encoded)
    }
  }
  return urls.filter((url) => {
    const large = url.replace(/m(\.\w+)$/i, "xl$1")
    return large === url || !urls.includes(large)
  })
}

export class ExtractionError extends Error {}

export const normalizeProductPage = (raw: RawProductPage): ManualProduct => {
  const all = lines(raw.boxText)
  const skuIndex = all.findIndex((line) => /^Intcomex SKU/i.test(line))
  const head = skuIndex === -1 ? all : all.slice(0, skuIndex)

  const sku = valueAfter(all, /^Intcomex SKU:?/i)
  const title = head[0]
  if (!sku || !title) {
    throw new ExtractionError(`No se encontró título o SKU en ${raw.url}`)
  }
  const costNet = parsePrice(raw.priceText)
  if (costNet === null) {
    throw new ExtractionError(`No se pudo leer el precio ("${raw.priceText}") en ${raw.url}`)
  }

  // Tras el título viene la marca (si está contenida en el título) y luego las viñetas.
  const second = head[1]
  const hasBrand = Boolean(second) && title.toLowerCase().includes(second.toLowerCase())
  const brand = hasBrand ? second : null
  const bullets = head.slice(hasBrand ? 2 : 1)

  const description = lines(raw.descriptionText)
    .filter((line, index) => !(index === 0 && /^descripci[oó]n del producto$/i.test(line)))
    .join("\n")
  const details = [bullets.length ? bullets.map((line) => `- ${line}`).join("\n") : "", description]
    .filter(Boolean)
    .join("\n\n")

  const stock = parseStock(raw.stockText)
  const mpn = valueAfter(all, /^N[uú]mero de parte:?/i)

  return {
    sourceUrl: raw.url,
    details,
    imageUrls: pickImages(raw.imageUrls),
    product: {
      Sku: sku,
      Mpn: mpn ?? undefined,
      Description: title,
      Type: "Physical",
      Brand: brand ? { Description: brand } : undefined,
      Category: buildCategory(raw.breadcrumb),
      // Los precios de la tienda están en US$ y son netos (sin IVA).
      Price: { UnitPrice: costNet, CurrencyId: "USD" },
      InStock: stock ?? undefined,
    },
  }
}

// Código que corre dentro de la página (Playwright lo invoca con el id del producto). Es un string
// porque el backend no incluye los tipos del DOM; devuelve solo textos para que normalizeProductPage
// concentre toda la interpretación y se pueda probar sin navegador.
export const EXTRACT_IN_PAGE = `(productId) => {
  const title = document.querySelector('.js-productName-' + productId)
  let box = title
  while (box && !/Intcomex SKU/.test(box.innerText)) box = box.parentElement
  const price = document.querySelector('.linkArea .font-price') || document.querySelector('.font-price')
  const stock = document.querySelector('.js-product-item-stock-' + productId)
  const description = document.querySelector('#tabs-1')
  // Imagen principal y galería de ESTE producto (los relacionados usan otras clases). Se resuelven a URL absoluta.
  const root = box && box.parentElement && box.parentElement.parentElement ? box.parentElement.parentElement : document
  const urls = []
  for (const el of root.querySelectorAll('img.img-products, img.img-thumb')) {
    urls.push(new URL(el.getAttribute('src'), location.href).href)
  }
  for (const el of document.querySelectorAll('img.mainImageBig, img.img-thumb-big')) {
    urls.push(new URL(el.getAttribute('src'), location.href).href)
  }
  for (const el of root.querySelectorAll('a[href*="/images/products/"]')) {
    urls.push(new URL(el.getAttribute('href'), location.href).href)
  }
  return {
    url: location.href.split('#')[0],
    productId,
    boxText: box ? box.innerText : '',
    priceText: price ? price.textContent.trim() : '',
    stockText: stock ? stock.textContent.trim() : null,
    breadcrumb: Array.from(document.querySelectorAll('[class*=breadcrumb] a')).map((a) => ({
      href: a.getAttribute('href'),
      text: a.textContent.trim(),
    })),
    descriptionText: description ? description.innerText : '',
    imageUrls: urls,
  }
}`
