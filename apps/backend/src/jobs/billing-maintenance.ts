import type { MedusaContainer } from "@medusajs/framework/types"

import { pollSiiStatus, retryFailed } from "../modules/billing/operations"
import { billingDeps, loadOrderForBilling } from "../modules/billing/runtime"
import { sendAlert } from "../lib/emails/send"
import { BILLING_MODULE } from "../modules/billing"
import type BillingModuleService from "../modules/billing/service"

// Cada 10 minutos: reintenta las boletas que fallaron por un problema pasajero y consulta al SII el
// estado de las recién emitidas. Un rechazo del SII se avisa al equipo.
export default async function billingMaintenance(container: MedusaContainer) {
  if (process.env.BILLING_AUTO_ISSUE === "false") {
    return
  }
  const deps = billingDeps(container)
  await retryFailed(deps, (orderId) => loadOrderForBilling(container, orderId))
  await pollSiiStatus(deps, {
    onRejected: async (documentId) => {
      const service: BillingModuleService = container.resolve(BILLING_MODULE)
      const [doc] = await service.listBillingDocuments({ id: documentId })
      await sendAlert(container, {
        title: `El SII rechazó el documento ${doc?.folio ?? ""}`.trim(),
        message: "El documento fue emitido pero el SII lo rechazó. Hay que revisarlo en OpenFactura.",
        details: [`Pedido: ${doc?.medusa_order_id ?? "-"}`, `Folio: ${doc?.folio ?? "-"}`],
      })
    },
  })
}

export const config = {
  name: "billing-maintenance",
  schedule: "*/10 * * * *",
}
