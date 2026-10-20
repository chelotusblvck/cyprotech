import { MedusaError } from "@medusajs/framework/utils"

import { CATEGORIES, uniqueSlug, type NewsCategory } from "./logic"
import { parseFeed } from "./rss"
import type NewsModuleService from "./service"

const GAMES: [string, RegExp][] = [
  ["gta", /\bgta\b|grand theft auto/i],
  ["fifa", /\bfifa\b|ea sports fc|\bea fc\b/i],
  ["halo", /\bhalo\b/i],
  ["valorant", /valorant/i],
  ["lol", /league of legends|\blol\b|\bworlds\b/i],
  ["overwatch", /overwatch/i],
]

const CATEGORY_HINTS: [NewsCategory, RegExp][] = [
  ["esports", /esports|torneo|tournament|campeonato|championship|\bworlds\b|\bvct\b|\bowcs\b/i],
  ["hardware", /nvidia|\bamd\b|\bintel\b|\bgpu\b|\brtx\b|\bryzen\b|radeon|procesador|tarjeta gr|monitor|teclado|\bssd\b/i],
  ["lanzamientos", /lanzamiento|launch|release|estreno|trailer|tráiler|fecha de salida|disponible/i],
]

export const guessGame = (text: string): string | null => GAMES.find(([, pattern]) => pattern.test(text))?.[0] ?? null

export const guessCategory = (text: string): NewsCategory =>
  CATEGORY_HINTS.find(([, pattern]) => pattern.test(text))?.[0] ?? (CATEGORIES.includes("industria") ? "industria" : CATEGORIES[0])

export const feedsFromEnv = (env: NodeJS.ProcessEnv = process.env): string[] =>
  (env.NEWS_RSS_FEEDS ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\//i.test(url))

type Fetcher = (url: string) => Promise<string>

// Algunas fuentes (p. ej. en ISO-8859-1) no usan UTF-8: se lee el charset del encabezado o de la
// declaración XML para no mostrar tildes rotas.
export const decodeBody = (body: Buffer, contentType: string | null): string => {
  const head = body.subarray(0, 200).toString("latin1")
  const charset =
    contentType?.match(/charset=([\w-]+)/i)?.[1] ?? head.match(/<\?xml[^>]*encoding=["']([\w-]+)["']/i)?.[1] ?? "utf-8"
  try {
    return new TextDecoder(charset).decode(body)
  } catch {
    return new TextDecoder("utf-8").decode(body)
  }
}

const httpFetch: Fetcher = async (url) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "CyprotechNews/1.0 (+contacto@cyprotech.cl)", accept: "application/rss+xml, application/atom+xml, text/xml" },
    })
    if (!res.ok) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `HTTP ${res.status}`)
    }
    return decodeBody(Buffer.from(await res.arrayBuffer()), res.headers.get("content-type"))
  } finally {
    clearTimeout(timer)
  }
}

export type ImportResult = { created: number; skipped: number; errors: { feed: string; error: string }[] }

// Trae las últimas entradas de cada fuente y las deja como BORRADOR sin imagen. Nada se publica solo:
// hay que revisarlas, escribir el resumen propio y subir un banner con derechos.
export const importFeeds = async (
  service: NewsModuleService,
  feeds: string[],
  options: { perFeed?: number; fetcher?: Fetcher } = {},
): Promise<ImportResult> => {
  const perFeed = options.perFeed ?? 8
  const fetcher = options.fetcher ?? httpFetch
  const result: ImportResult = { created: 0, skipped: 0, errors: [] }

  const existing = await service.listNewsPosts({}, { select: ["slug", "source_url"], take: 5000 })
  const slugs = new Set(existing.map((post) => post.slug))
  const sources = new Set(existing.map((post) => post.source_url).filter(Boolean) as string[])

  for (const feed of feeds) {
    let items
    try {
      items = parseFeed(await fetcher(feed)).slice(0, perFeed)
    } catch (error) {
      result.errors.push({ feed, error: error instanceof Error ? error.message : String(error) })
      continue
    }
    for (const item of items) {
      if (sources.has(item.link)) {
        result.skipped += 1
        continue
      }
      const slug = uniqueSlug(item.title, slugs)
      slugs.add(slug)
      sources.add(item.link)
      const text = `${item.title} ${item.summary}`
      let host = ""
      try {
        host = new URL(item.link).hostname.replace(/^www\./, "")
      } catch {
        host = ""
      }
      await service.createNewsPosts({
        title: item.title,
        slug,
        summary: item.summary || item.title,
        category: guessCategory(text),
        game: guessGame(text),
        source_name: host || null,
        source_url: item.link,
        status: "draft",
        origin: "rss",
        published_at: item.publishedAt,
      })
      result.created += 1
    }
  }
  return result
}
