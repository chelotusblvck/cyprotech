import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deleteProductsWorkflow } from "@medusajs/medusa/core-flows"

// Borra los productos que no vienen de Intcomex de verdad: los de muestra (metadata.demo = true) y los
// cargados por una sincronización con el catálogo simulado (corridas con mock = true). Con DRY_RUN=true
// solo informa. No toca pedidos, clientes ni categorías.
export default async function removeMockCatalog({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const dryRun = process.env.DRY_RUN === "true"

  const mockRuns = (await pg.raw("select count(*)::int as n from intcomex_sync_run where mock = true")).rows[0].n as number
  const realRuns = (await pg.raw("select count(*)::int as n from intcomex_sync_run where mock = false")).rows[0].n as number
  if (realRuns > 0) {
    logger.error(`Hay ${realRuns} sincronizaciones reales: este script es solo para limpiar un catálogo simulado. No se borra nada.`)
    return
  }

  const { data: products } = await query.graph({ entity: "product", fields: ["id", "metadata"] })
  const demoIds = products
    .filter((product: { metadata?: Record<string, unknown> | null }) => product.metadata?.demo === true)
    .map((product: { id: string }) => product.id)

  const linked = (await pg.raw("select medusa_product_id from intcomex_product where medusa_product_id is not null")).rows as {
    medusa_product_id: string
  }[]
  const mockIds = linked.map((row) => row.medusa_product_id)

  const ids = [...new Set([...demoIds, ...mockIds])]
  logger.info(`Productos a borrar: ${ids.length} (${demoIds.length} de muestra, ${mockIds.length} del catálogo simulado). Corridas simuladas: ${mockRuns}.`)
  if (dryRun) {
    logger.info("DRY_RUN: no se borró nada.")
    return
  }

  for (let i = 0; i < ids.length; i += 20) {
    await deleteProductsWorkflow(container).run({ input: { ids: ids.slice(i, i + 20) } })
  }
  await pg.raw("delete from intcomex_product")
  await pg.raw("delete from intcomex_sync_run where mock = true")
  logger.info(`Listo: ${ids.length} productos eliminados y registros de Intcomex simulados vaciados.`)
}
