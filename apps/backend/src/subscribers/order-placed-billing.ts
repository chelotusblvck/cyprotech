import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { issueDocument } from "../modules/billing/operations"
import { billingDeps, loadOrderForBilling } from "../modules/billing/runtime"

// Emite la boleta (o la factura, si el cliente la pidió) apenas se confirma el pago. Se apaga con
// BILLING_AUTO_ISSUE=false. Las fallas quedan registradas y se reintentan solas (ver el trabajo
// billing-retry); no afectan la venta.
export default async function orderPlacedBillingHandler({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  if (process.env.BILLING_AUTO_ISSUE === "false") {
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
