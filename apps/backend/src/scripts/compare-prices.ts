import { readFileSync, writeFileSync } from "node:fs"

import { calculatePrice, fetchUsdClp, loadPricingConfig, normalizeCurrency } from "../lib/pricing"
import {
  csvCell,
  floorPublicPrice,
  marginAfterFee,
  matchesPartNumber,
  median,
  searchTerms,
  suggestPrice,
  type MarketOffer,
} from "../lib/pricing/compare"

// Compara nuestros precios con el mercado chileno. SOLO LEE: no toca la base de datos ni la tienda.
// Entrada: el JSON de la carga manual (intcomex-manual.json). Salida: un CSV para revisar y aprobar (tarea 23).
//
// Tiendas consultadas (respetando su robots.txt y su Crawl-delay, una consulta por producto y tienda):
//   - ProGaming: API publica de WooCommerce (/wp-json/wc/store/v1/products).
//   - Winpy: pagina de resultados del buscador (/search/?q=). Publica el precio por transferencia.
// Sin consulta automatica (revision manual): SP Digital (carga con JavaScript), PC Factory (su robots.txt
// prohibe /busqueda), MyShop, Casa Royal, Congrap y las tiendas locales de Santiago.
//
// Uso (desde apps/backend):
//   npx ts-node src/scripts/compare-prices.ts [--file intcomex-manual.json] [--out comparacion-precios.csv]
//        [--limit 10] [--discount 1] [--stores progaming,winpy]

const USER_AGENT = "CyprotechPriceCheck/1.0 (lectura de precios publicos; contacto marcelofcn23@gmail.com)"
const MIN_DELAY_MS = 6000

const argValue = (flag: string, fallback: string) => {
  const index = process.argv.indexOf(flag)
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type StoreAdapter = {
  name: string
  origin: string
  // Ruta (con query) que se pide para un termino de busqueda; se valida contra robots.txt antes.
  path: (term: string) => string
  parse: (body: string, origin: string) => MarketOffer[]
}

const decodeEntities = (text: string) =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const progaming: StoreAdapter = {
  name: "ProGaming",
  origin: "https://progaming.cl",
  path: (term) => `/wp-json/wc/store/v1/products?per_page=10&search=${encodeURIComponent(term)}`,
  parse: (body) => {
    const items = JSON.parse(body) as {
      name: string
      sku?: string
      permalink: string
      description?: string
      prices?: { price?: string; currency_minor_unit?: number }
    }[]
    return items.flatMap((item) => {
      const price = Number(item.prices?.price)
      if (!Number.isFinite(price) || price <= 0) {
        return []
      }
      const divisor = 10 ** (item.prices?.currency_minor_unit ?? 0)
      return [
        {
          store: "ProGaming",
          title: decodeEntities(item.name),
          url: item.permalink,
          priceClp: Math.round(price / divisor),
          // La descripcion de ProGaming trae el numero de parte entre parentesis.
          matchText: decodeEntities(`${item.name} ${item.sku ?? ""} ${item.description ?? ""}`),
        },
      ]
    })
  },
}

const winpy: StoreAdapter = {
  name: "Winpy",
  origin: "https://www.winpy.cl",
  path: (term) => `/search/?q=${encodeURIComponent(term)}`,
  parse: (body, origin) => {
    const offers: MarketOffer[] = []
    for (const article of body.split("<article>").slice(1)) {
      const link = /<h2><a href="([^"]+)"[^>]*>([^<]+)<\/a><\/h2>/.exec(article)
      const desc = /<p class="desc">([^<]*)<\/p>/.exec(article)
      const price = /<div class="price-oferta">\s*<h2>\s*\$\s*([\d.]+)\s*<\/h2>\s*<p class="note">([^<]*)<\/p>/.exec(
        article,
      )
      if (!link || !price) {
        continue
      }
      offers.push({
        store: "Winpy",
        title: decodeEntities(link[2]),
        url: new URL(link[1], origin).href,
        priceClp: Number(price[1].replace(/\./g, "")),
        matchText: decodeEntities(`${link[2]} ${desc?.[1] ?? ""}`),
        note: decodeEntities(price[2]),
      })
    }
    return offers
  },
}

const ADAPTERS: Record<string, StoreAdapter> = { progaming, winpy }

// robots.txt: reglas del grupo "*" (suficiente para este uso). Devuelve prefijos Disallow/Allow y Crawl-delay.
type Robots = { disallow: string[]; allow: string[]; crawlDelayMs: number }

const loadRobots = async (origin: string): Promise<Robots> => {
  const response = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT } })
  const robots: Robots = { disallow: [], allow: [], crawlDelayMs: 0 }
  if (!response.ok) {
    return robots
  }
  let inStarGroup = false
  for (const raw of (await response.text()).split(/\r?\n/)) {
    const line = raw.split("#")[0].trim()
    const [key, ...rest] = line.split(":")
    const value = rest.join(":").trim()
    switch (key.toLowerCase()) {
      case "user-agent":
        inStarGroup = value === "*"
        break
      case "disallow":
        if (inStarGroup && value) {
          robots.disallow.push(value)
        }
        break
      case "allow":
        if (inStarGroup && value) {
          robots.allow.push(value)
        }
        break
      case "crawl-delay":
        if (inStarGroup && Number(value) > 0) {
          robots.crawlDelayMs = Number(value) * 1000
        }
        break
    }
  }
  return robots
}

const ruleToRegex = (rule: string) => {
  const escaped = rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
  return new RegExp(`^${escaped}`)
}

// Gana la regla mas larga que coincida; en empate, Allow.
const isAllowed = (robots: Robots, path: string): boolean => {
  const longest = (rules: string[]) =>
    rules.filter((rule) => ruleToRegex(rule).test(path)).reduce((max, rule) => Math.max(max, rule.length), -1)
  return longest(robots.allow) >= longest(robots.disallow)
}

type ManualEntry = {
  product: {
    Sku: string
    Mpn?: string
    Description: string
    Price?: { UnitPrice: number; CurrencyId?: string }
  }
}

const main = async () => {
  const file = argValue("--file", "intcomex-manual.json")
  const out = argValue("--out", "comparacion-precios.csv")
  const limit = Number(argValue("--limit", "0"))
  const discount = Number(argValue("--discount", "1"))
  const storeNames = argValue("--stores", Object.keys(ADAPTERS).join(",")).split(",")

  const entries = (JSON.parse(readFileSync(file, "utf8")) as ManualEntry[]).slice(0, limit > 0 ? limit : undefined)
  const config = loadPricingConfig()
  const { rate } = await fetchUsdClp()
  console.log(`Tipo de cambio ${rate}. ${entries.length} productos.`)

  const adapters = storeNames.map((name) => ADAPTERS[name.trim()]).filter(Boolean)
  const robotsByStore = new Map<string, Robots>()
  for (const adapter of adapters) {
    robotsByStore.set(adapter.name, await loadRobots(adapter.origin))
  }

  const header = [
    "sku",
    "mpn",
    "titulo",
    "costo_neto_clp",
    "precio_actual",
    "margen_neto_tras_flow_pct",
    "piso_precio",
    "ofertas_mercado",
    "mediana_mercado",
    "minimo_mercado",
    "precio_sugerido",
    "bajo_el_piso",
    "revision",
    "detalle_ofertas",
  ]
  const rows: string[] = [header.join(";")]
  let first = true

  for (const entry of entries) {
    const product = entry.product
    if (!product.Price) {
      continue
    }
    const priced = calculatePrice(
      { costNet: product.Price.UnitPrice, currency: normalizeCurrency(product.Price.CurrencyId) },
      rate,
      config,
    )
    const floor = floorPublicPrice(priced.costNetClp, config)
    const offers: MarketOffer[] = []
    const problems: string[] = []

    if (!product.Mpn) {
      problems.push("sin numero de parte")
    }
    for (const adapter of adapters) {
      if (!product.Mpn) {
        break
      }
      const robots = robotsByStore.get(adapter.name)!
      // Se prueba el numero de parte y luego el modelo; basta que un termino traiga ofertas cruzadas.
      for (const term of searchTerms(product.Description, product.Mpn)) {
        const path = adapter.path(term)
        if (!isAllowed(robots, path)) {
          problems.push(`${adapter.name}: robots.txt no permite la consulta`)
          break
        }
        if (!first) {
          await sleep(Math.max(MIN_DELAY_MS, robots.crawlDelayMs))
        }
        first = false
        try {
          const response = await fetch(`${adapter.origin}${path}`, { headers: { "User-Agent": USER_AGENT } })
          if (!response.ok) {
            problems.push(`${adapter.name}: HTTP ${response.status}`)
            break
          }
          const found = adapter.parse(await response.text(), adapter.origin)
          // Solo se aceptan ofertas cuyo texto contiene el numero de parte completo.
          const matched = found.filter((offer) => matchesPartNumber(product.Mpn, offer.matchText))
          offers.push(...matched.filter((offer) => !offers.some((known) => known.url === offer.url)))
          if (matched.length) {
            break
          }
        } catch (error) {
          problems.push(`${adapter.name}: ${(error as Error).message}`)
          break
        }
      }
    }

    const prices = offers.map((offer) => offer.priceClp)
    const marketMedian = median(prices)
    const suggestion = suggestPrice(floor, marketMedian, discount, config.roundTo)
    const review = problems.length
      ? problems.join(" | ")
      : offers.length
        ? ""
        : "sin cruce seguro en las tiendas consultadas"

    rows.push(
      [
        product.Sku,
        product.Mpn ?? "",
        product.Description.slice(0, 90),
        Math.round(priced.costNetClp),
        priced.publicPrice,
        marginAfterFee({ publicPrice: priced.publicPrice, costNetClp: priced.costNetClp, ...config }).toFixed(1),
        floor,
        offers.length,
        marketMedian ?? "",
        prices.length ? Math.min(...prices) : "",
        suggestion.suggested ?? "",
        suggestion.belowFloor ? "SI" : "",
        review,
        offers
          .map((offer) => `${offer.store} ${offer.priceClp}${offer.note ? ` (${offer.note})` : ""} ${offer.url}`)
          .join(" | "),
      ]
        .map(csvCell)
        .join(";"),
    )
    console.log(
      `${product.Sku} ${product.Mpn ?? "-"}: ${offers.length} ofertas${suggestion.belowFloor ? " (mercado bajo el piso)" : ""}`,
    )
  }

  // BOM para que Excel lea bien las tildes.
  writeFileSync(out, `﻿${rows.join("\n")}\n`, "utf8")
  console.log(`CSV escrito en ${out}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
