import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"

// Habilita Flow como medio de pago de la región Chile en una base ya creada.
// El pago manual (pp_system_default) solo se mantiene fuera de producción.
// Uso: npx medusa exec ./src/scripts/enable-flow.ts
export default async function enableFlow({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [region],
  } = await query.graph({ entity: "region", fields: ["id"], filters: { name: "Chile" } })
  if (!region) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "No existe la región Chile. Ejecuta primero setup-chile.")
  }

  const providers = process.env.NODE_ENV === "production" ? ["pp_flow_flow"] : ["pp_flow_flow", "pp_system_default"]
  await updateRegionsWorkflow(container).run({
    input: { selector: { id: region.id }, update: { payment_providers: providers } },
  })
  logger.info(`Medios de pago de Chile: ${providers.join(", ")}`)
}
