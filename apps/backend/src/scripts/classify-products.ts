import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { classifyProducts } from "../lib/catalog/classify"

// Marca canonica y etiqueta gamer en todo el catalogo. Respeta metadata.classification_locked.
// Uso: npx medusa exec ./src/scripts/classify-products.ts [dry-run] [reindex]
// reindex: vuelve a indexar todos los productos en la busqueda (sirve si la marca ya estaba guardada).
export default async function classifyProductsScript({ container, args }: ExecArgs) {
  const dryRun = (args ?? []).includes("dry-run")
  const changes = await classifyProducts(container, { dryRun })

  const toChange = changes.filter((change) => change.changed)
  console.log(`${changes.length} productos revisados, ${toChange.length} ${dryRun ? "cambiarian" : "actualizados"}.`)
  for (const change of toChange) {
    console.log(`${change.gamer ? "[gamer]" : "       "} ${change.brand ?? "SIN MARCA"}${change.line ? ` / ${change.line}` : ""} | ${change.title.slice(0, 70)}`)
  }
  if (!dryRun && (args ?? []).includes("reindex")) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({ entity: "product", fields: ["id"] })
    await container.resolve(Modules.EVENT_BUS).emit(
      (data as { id: string }[]).map((product) => ({ name: "product.updated", data: { id: product.id } })),
    )
    console.log(`
${data.length} productos enviados a reindexar.`)
  }
  const noBrand = changes.filter((change) => !change.brand)
  if (noBrand.length) {
    console.log(`\nSin marca reconocida (revisar a mano o agregar a src/lib/catalog/brands.ts):`)
    for (const change of noBrand) {
      console.log(`  ${change.title.slice(0, 80)}`)
    }
  }
}
