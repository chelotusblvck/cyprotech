import type { ExecArgs } from "@medusajs/framework/types"

import { classifyProducts } from "../lib/catalog/classify"

// Marca canonica y etiqueta gamer en todo el catalogo. Respeta metadata.classification_locked.
// Uso: npx medusa exec ./src/scripts/classify-products.ts [dry-run]
export default async function classifyProductsScript({ container, args }: ExecArgs) {
  const dryRun = (args ?? []).includes("dry-run")
  const changes = await classifyProducts(container, { dryRun })

  const toChange = changes.filter((change) => change.changed)
  console.log(`${changes.length} productos revisados, ${toChange.length} ${dryRun ? "cambiarian" : "actualizados"}.`)
  for (const change of toChange) {
    console.log(`${change.gamer ? "[gamer]" : "       "} ${change.brand ?? "SIN MARCA"}${change.line ? ` / ${change.line}` : ""} | ${change.title.slice(0, 70)}`)
  }
  const noBrand = changes.filter((change) => !change.brand)
  if (noBrand.length) {
    console.log(`\nSin marca reconocida (revisar a mano o agregar a src/lib/catalog/brands.ts):`)
    for (const change of noBrand) {
      console.log(`  ${change.title.slice(0, 80)}`)
    }
  }
}
