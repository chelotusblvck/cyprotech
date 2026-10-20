import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { LEDGER_MODULE } from "../../../../modules/ledger"
import { releaseDueOrders } from "../../../../modules/ledger/operations"
import type LedgerModuleService from "../../../../modules/ledger/service"

// Ejecuta a mano el reconocimiento de utilidad (el trabajo diario hace lo mismo a las 04:00).
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const ledger: LedgerModuleService = req.scope.resolve(LEDGER_MODULE)
  res.json({ released: await releaseDueOrders(ledger) })
}
