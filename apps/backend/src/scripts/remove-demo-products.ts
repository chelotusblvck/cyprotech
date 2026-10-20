import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deleteProductsWorkflow } from "@medusajs/medusa/core-flows"

// Borra los productos de muestra (metadata.demo = true) creados por seed-demo-gaming.
export default async function removeDemoProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "metadata"],
  })
  const ids = products
    .filter((product: { metadata?: Record<string, unknown> | null }) => product.metadata?.demo === true)
    .map((product: { id: string }) => product.id)

  if (ids.length) {
    await deleteProductsWorkflow(container).run({ input: { ids } })
  }
  logger.info(`${ids.length} productos de muestra eliminados.`)
}
