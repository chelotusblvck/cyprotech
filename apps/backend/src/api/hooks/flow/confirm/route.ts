import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { settleFlowPayment } from "../../../../modules/flow/settle"

// Aviso de Flow (urlConfirmation): llega por POST con el token de la orden. No se confía en el
// aviso en sí; settleFlowPayment consulta el estado a Flow y recién ahí completa el carrito.
// Se responde 200 salvo error inesperado, para que Flow reintente solo cuando corresponde.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const token = ((req.body as { token?: string } | undefined)?.token ?? (req.query.token as string | undefined))?.trim()
  if (!token) {
    res.status(400).json({ message: "Falta el token." })
    return
  }
  try {
    const result = await settleFlowPayment(req.scope, token)
    logger.info(`Flow confirmó ${token.slice(0, 8)}...: ${result.state}${result.orderId ? ` (${result.orderId})` : ""}`)
    res.sendStatus(200)
  } catch (error) {
    logger.error(`Flow: no se pudo procesar la confirmación: ${(error as Error).message}`)
    res.sendStatus(500)
  }
}
