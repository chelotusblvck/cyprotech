import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"

import { loadTransferConfig, transferDeadline } from "../lib/transfer/config"
import { isAwaitingTransfer, transferStateOf, type OrderRow } from "../lib/transfer/state"

// Cancela los pedidos por transferencia que no se pagaron dentro del plazo (TRANSFER_DEADLINE_HOURS) para
// liberar el stock reservado. Un pedido ya pagado o cancelado no se toca. Cada hora.
export default async function transferExpireOrders(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { deadlineHours } = loadTransferConfig()

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "status",
      "created_at",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.captured_at",
    ],
    filters: { status: "pending" },
  })

  const now = Date.now()
  for (const row of orders as unknown as (OrderRow & { id: string; display_id?: number })[]) {
    const state = transferStateOf(row)
    if (!isAwaitingTransfer(state) || !state.createdAt) {
      continue
    }
    if (transferDeadline(state.createdAt, deadlineHours).getTime() > now) {
      continue
    }
    try {
      await cancelOrderWorkflow(container).run({ input: { order_id: row.id } })
      logger.info(`Pedido ${row.display_id ?? row.id} cancelado: no se recibio la transferencia a tiempo`)
    } catch (error) {
      logger.warn(`No se pudo cancelar el pedido ${row.id} por falta de transferencia: ${(error as Error).message}`)
    }
  }
}

export const config = {
  name: "transfer-expire-orders",
  schedule: "15 * * * *",
}
