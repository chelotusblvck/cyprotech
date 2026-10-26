import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { sendOrderEmail } from "../lib/emails/send"
import { loadTransferState } from "../lib/transfer/state"
import { issueDocument } from "../modules/billing/operations"
import { billingDeps, loadOrderForBilling } from "../modules/billing/runtime"
import { placeIntcomexOrderWorkflow } from "../workflows/place-intcomex-order"

type Pg = { raw: (sql: string, bindings: unknown[]) => Promise<{ rows: { order_id: string }[] }> }

// El vinculo pedido-pago es una tabla de enlace de Medusa.
const orderIdOfPayment = async (pg: Pg, paymentId: string) => {
  const { rows } = await pg.raw(
    `select o.order_id
       from order_payment_collection o
       join payment p on p.payment_collection_id = o.payment_collection_id
      where p.id = ? and p.deleted_at is null and o.deleted_at is null`,
    [paymentId],
  )
  return rows[0]?.order_id ?? null
}

// Al confirmar a mano una transferencia (capturar el pago en el admin) se hace lo que el pedido pagado con
// Flow hace al nacer: confirmacion al cliente, boleta o factura y pedido a Intcomex. Los pagos de Flow no
// entran aqui; solo los de transferencia.
export default async function paymentCapturedTransferHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as Pg
  const orderId = await orderIdOfPayment(pg, data.id)
  if (!orderId) {
    return
  }
  const state = await loadTransferState(container, orderId)
  if (!state.isTransfer || !state.paid || state.canceled) {
    return
  }

  await sendOrderEmail(container, orderId, "order-confirmed")

  if (process.env.BILLING_AUTO_ISSUE !== "false") {
    const order = await loadOrderForBilling(container, orderId)
    if (order) {
      await issueDocument(billingDeps(container), order)
    }
  }
  if (process.env.INTCOMEX_AUTO_PLACE_ORDERS === "true") {
    await placeIntcomexOrderWorkflow(container).run({ input: { orderId } })
  }
  logger.info(`Transferencia confirmada para el pedido ${orderId}`)
}

export const config: SubscriberConfig = {
  event: "payment.captured",
}
