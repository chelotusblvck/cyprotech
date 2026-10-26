import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { isAwaitingTransfer, loadTransferState } from "../lib/transfer/state"
import { placeIntcomexOrderWorkflow } from "../workflows/place-intcomex-order"

// Coloca el pedido en Intcomex apenas se confirma la compra. Queda apagado por defecto:
// se activa con INTCOMEX_AUTO_PLACE_ORDERS=true cuando el pago (Flow) esté integrado y
// Intcomex haya aprobado la línea de crédito. Mientras tanto se coloca a mano desde el dashboard.
export default async function orderPlacedIntcomexHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  if (process.env.INTCOMEX_AUTO_PLACE_ORDERS !== "true") {
    return
  }
  // Transferencia sin pago recibido: el pedido a Intcomex se coloca al capturar el pago.
  if (isAwaitingTransfer(await loadTransferState(container, data.id))) {
    return
  }
  await placeIntcomexOrderWorkflow(container).run({ input: { orderId: data.id } })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
