import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { sendOrderEmail } from "../lib/emails/send"
import { sendTransferInstructions } from "../lib/transfer/notify"
import { isAwaitingTransfer, loadTransferState } from "../lib/transfer/state"

// Correo apenas se confirma el pago. Con transferencia directa el pedido nace sin pago: se envian las
// instrucciones y la confirmacion sale cuando se captura el pago (payment-captured-transfer). Si el envio
// falla no afecta la venta (sendEmail registra el error y sigue).
export default async function orderPlacedEmailHandler({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  if (isAwaitingTransfer(await loadTransferState(container, data.id))) {
    await sendTransferInstructions(container, data.id)
    return
  }
  await sendOrderEmail(container, data.id, "order-confirmed")
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
