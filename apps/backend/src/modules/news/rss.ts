import { XMLParser } from "fast-xml-parser"

export type FeedItem = {
  title: string
  summary: string
  link: string
  publishedAt: Date | null
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", processEntities: true, trimValues: true })

const asArray = <T>(value: T | T[] | undefined): T[] => (value === undefined ? [] : Array.isArray(value) ? value : [value])

// Texto de un nodo que puede venir como string o como { "#text": ... }.
const textOf = (node: unknown): string => {
  if (typeof node === "string") {
    return node
  }
  if (typeof node === "number") {
    return String(node)
  }
  if (node && typeof node === "object" && "#text" in node) {
    return String((node as Record<string, unknown>)["#text"])
  }
  return ""
}

const decodeEntities = (text: string) =>
  text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))

// Quita etiquetas y deja el texto plano, recortado a una frase corta en un límite de palabra.
export const toExcerpt = (html: string, max = 220): string => {
  const plain = decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim()
  if (plain.length <= max) {
    return plain
  }
  const cut = plain.slice(0, max)
  const lastSpace = cut.lastIndexOf(" ")
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).replace(/[.,;:\s]+$/, "")}...`
}

const parseDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

// Lee RSS 2.0 y Atom. Ignora entradas sin título o sin enlace.
export const parseFeed = (xml: string): FeedItem[] => {
  const doc = parser.parse(xml)
  const items: FeedItem[] = []

  for (const item of asArray(doc?.rss?.channel?.item)) {
    const title = decodeEntities(textOf(item.title)).trim()
    const link = textOf(item.link).trim()
    if (title && link) {
      items.push({
        title,
        link,
        summary: toExcerpt(textOf(item.description) || textOf(item["content:encoded"])),
        publishedAt: parseDate(textOf(item.pubDate)),
      })
    }
  }

  for (const entry of asArray(doc?.feed?.entry)) {
    const title = decodeEntities(textOf(entry.title)).trim()
    const links = asArray(entry.link) as { "@_href"?: string; "@_rel"?: string }[]
    const link = (links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? links[0])?.["@_href"]?.trim()
    if (title && link) {
      items.push({
        title,
        link,
        summary: toExcerpt(textOf(entry.summary) || textOf(entry.content)),
        publishedAt: parseDate(textOf(entry.published) || textOf(entry.updated)),
      })
    }
  }

  return items
}
