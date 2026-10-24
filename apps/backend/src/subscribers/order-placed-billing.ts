import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { issueDocument } from "../modules/billing/operations"
import { isAwaitingTransfer, loadTransferState } from "../lib/transfer/state"
import { billingDeps, loadOrderForBilling } from "../modules/billing/runtime"

// Emite la boleta (o la factura, si el cliente la pidió) apenas se confirma el pago. Se apaga con
// BILLING_AUTO_ISSUE=false. Las fallas quedan registradas y se reintentan solas (ver el trabajo
// billing-retry); no afectan la venta.
export default async function orderPlacedBillingHandler({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  if (process.env.BILLING_AUTO_ISSUE === "false") {
    return
  }
  // Transferencia sin pago recibido: se factura al capturar el pago (payment-captured-transfer).
  if (isAwaitingTransfer(await loadTransferState(container, data.id))) {
    return
  }
  const order = await loadOrderForBilling(container, data.id)
  if (order) {
    await issueDocument(billingDeps(container), order)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
