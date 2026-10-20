import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

import { LEDGER_MODULE } from "../../../../../../modules/ledger"
import { closePeriod } from "../../../../../../modules/ledger/operations"
import type LedgerModuleService from "../../../../../../modules/ledger/service"

const bodySchema = z.object({ force: z.boolean().optional() })

// Cierra el mes: registra los costos fijos pendientes, congela los totales y genera los pagos.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = bodySchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ message: "Parámetros inválidos" })
    return
  }
  const ledger: LedgerModuleService = req.scope.resolve(LEDGER_MODULE)
  try {
    res.json(await closePeriod(ledger, req.params.period, { force: parsed.data.force }))
  } catch (error) {
    const status = error instanceof MedusaError && error.type === MedusaError.Types.NOT_ALLOWED ? 409 : 400
    res.status(status).json({ message: (error as Error).message })
  }
}
