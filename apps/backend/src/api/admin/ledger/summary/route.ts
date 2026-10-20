import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { LEDGER_MODULE } from "../../../../modules/ledger"
import { periodOf } from "../../../../modules/ledger/logic"
import { periodSummary } from "../../../../modules/ledger/operations"
import type LedgerModuleService from "../../../../modules/ledger/service"

// Resumen de un período del ledger: asientos, totales (reales si está cerrado, proyectados si
// está abierto), reparto entre socios y pagos.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ledger: LedgerModuleService = req.scope.resolve(LEDGER_MODULE)
  const period = (req.query.period as string | undefined) ?? periodOf(new Date())
  res.json(await periodSummary(ledger, period))
}
