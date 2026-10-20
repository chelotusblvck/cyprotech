import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { sendOrderEmail } from "../lib/emails/send"

// Correo de confirmación apenas se confirma el pago. Si el envío falla no afecta la venta
// (sendEmail registra el error y sigue).
export default async function orderPlacedEmailHandler({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  await sendOrderEmail(container, data.id, "order-confirmed")
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
