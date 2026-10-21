import { readFileSync, writeFileSync } from "node:fs"
import { chromium } from "playwright-core"

import {
  detailUrl,
  EXTRACT_IN_PAGE,
  ExtractionError,
  normalizeProductPage,
  productIdFromUrl,
  type ManualProduct,
  type RawProductPage,
} from "../modules/intcomex/manual/normalize"

// Lee productos de store.intcomex.com usando un Chrome que ya tiene la sesión iniciada (no guarda
// ni usa credenciales). Escribe un JSON que luego carga import-intcomex-manual.ts.
//
// Preparación (una vez): abrir Chrome con un perfil propio y depuración remota, e iniciar sesión en la tienda.
// Chrome no permite la depuración remota sobre el perfil por defecto, por eso el --user-data-dir:
//   & "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:USERPROFILE\chrome-intcomex"
//
// Uso (desde apps/backend):
//   npx ts-node src/scripts/extract-intcomex-urls.ts <url|id> [<url|id> ...] [--file urls.txt] [--out productos.json] [--port 9222] [--delay 3000]
// Si --out ya existe, los productos se agregan o reemplazan por SKU.

const argValue = (args: string[], flag: string) => {
  const index = args.indexOf(flag)
  return index === -1 ? undefined : args[index + 1]
}

const readTargets = (args: string[]) => {
  const flagsWithValue = new Set(["--file", "--out", "--port", "--delay"])
  const positional = args.filter((arg, index) => !arg.startsWith("--") && !flagsWithValue.has(args[index - 1]))
  const file = argValue(args, "--file")
  const fromFile = file
    ? readFileSync(file, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
    : []
  return [...positional, ...fromFile].map(detailUrl)
}

const loadExisting = (path: string): ManualProduct[] => {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ManualProduct[]
  } catch {
    return []
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  const args = process.argv.slice(2)
  const targets = readTargets(args)
  if (targets.length === 0) {
    console.error("Indica al menos una URL o id de producto (o --file urls.txt).")
    process.exit(1)
  }
  const out = argValue(args, "--out") ?? "intcomex-manual.json"
  const port = Number(argValue(args, "--port") ?? 9222)
  const delay = Number(argValue(args, "--delay") ?? 3000)

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`).catch(() => {
    console.error(`No se pudo conectar a Chrome en el puerto ${port}. Revisa que esté abierto con --remote-debugging-port=${port}.`)
    process.exit(1)
  })
  // El contexto por defecto es el del Chrome ya logueado; las páginas nuevas comparten su sesión.
  const context = browser.contexts()[0]
  const page = await context.newPage()

  const results = new Map(loadExisting(out).map((entry) => [entry.product.Sku, entry]))
  const failures: string[] = []

  try {
    for (const [index, url] of targets.entries()) {
      const productId = productIdFromUrl(url)
      if (!productId) {
        console.error(`[${index + 1}/${targets.length}] URL no válida: ${url}`)
        failures.push(url)
        continue
      }
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 })
        const loaded = await page
          .waitForSelector(`.js-productName-${productId}`, { timeout: 15_000 })
          .then(() => true)
          .catch(() => false)
        if (!loaded) {
          const loggedOut = /login|logon|account\/(sign|log)/i.test(page.url())
          throw new ExtractionError(loggedOut ?"La sesión no está iniciada en este Chrome." : "No apareció el producto en la página.")
        }
        const raw = (await page.evaluate(EXTRACT_IN_PAGE, productId)) as RawProductPage
        const product = normalizeProductPage(raw)
        results.set(product.product.Sku, product)
        const price = product.product.Price
        console.log(
          `[${index + 1}/${targets.length}] ${product.product.Sku} ${price?.UnitPrice} ${price?.CurrencyId} stock=${product.product.InStock ?? "?"} - ${product.product.Description}`,
        )
      } catch (error) {
        console.error(`[${index + 1}/${targets.length}] ${url}: ${(error as Error).message}`)
        failures.push(url)
      }
      if (index < targets.length - 1) {
        await sleep(delay)
      }
    }
  } finally {
    await page.close()
    // Solo se desconecta: el Chrome del usuario queda abierto.
    await browser.close().catch(() => undefined)
  }

  writeFileSync(out, JSON.stringify([...results.values()], null, 2))
  console.log(`\n${targets.length - failures.length} de ${targets.length} productos en ${out} (${results.size} en total).`)
  if (failures.length) {
    console.log(`Fallaron:\n${failures.map((url) => `  ${url}`).join("\n")}`)
    process.exitCode = 1
  }
}

main()
