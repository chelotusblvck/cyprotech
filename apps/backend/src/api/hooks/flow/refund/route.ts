import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// Aviso de Flow cuando un reembolso se acepta, rechaza o completa. Por ahora solo se registra:
// el estado real se consulta en Flow (refund/getStatus) al conciliar.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const token = (req.body as { token?: string } | undefined)?.token
  logger.info(`Flow avisó un cambio de reembolso (${token ? `${token.slice(0, 8)}...` : "sin token"}).`)
  res.sendStatus(200)
}
