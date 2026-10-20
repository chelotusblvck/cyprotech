import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { issueCreditNote } from "../modules/billing/operations"
import { BILLING_MODULE } from "../modules/billing"
import { billingDeps } from "../modules/billing/runtime"
import type BillingModuleService from "../modules/billing/service"

// Un pedido cancelado deja un documento emitido que hay que anular con una nota de crédito. Es una
// acción tributaria, así que por defecto no es automática: se hace desde el dashboard. Con
// BILLING_AUTO_CREDIT_NOTE=true se emite sola al cancelar.
export default async function orderCanceledBillingHandler({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  if (process.env.BILLING_AUTO_CREDIT_NOTE !== "true") {
    return
  }
  const service: BillingModuleService = container.resolve(BILLING_MODULE)
  const docs = await service.listBillingDocuments({ medusa_order_id: data.id, state: "issued" })
  const original = docs.find((doc) => doc.kind !== "nota_credito")
  if (original) {
    await issueCreditNote(billingDeps(container), original.id, "Anula documento por cancelación del pedido")
  }
}

export const config: SubscriberConfig = {
  event: "order.canceled",
}
