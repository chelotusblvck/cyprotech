import type { MedusaContainer } from "@medusajs/framework/types"

import { LEDGER_MODULE } from "../modules/ledger"
import { releaseDueOrders } from "../modules/ledger/operations"
import type LedgerModuleService from "../modules/ledger/service"

// Reconoce en el ledger la utilidad de los pedidos entregados cuyo plazo de retracto ya venció.
export default async function ledgerReleaseOrders(container: MedusaContainer) {
  const ledger: LedgerModuleService = container.resolve(LEDGER_MODULE)
  await releaseDueOrders(ledger)
}

export const config = {
  name: "ledger-release-orders",
  schedule: "0 4 * * *",
}
