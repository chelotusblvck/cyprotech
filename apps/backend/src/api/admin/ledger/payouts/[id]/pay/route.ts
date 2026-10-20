import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

import { LEDGER_MODULE } from "../../../../../../modules/ledger"
import { payPayout } from "../../../../../../modules/ledger/operations"
import type LedgerModuleService from "../../../../../../modules/ledger/service"

const bodySchema = z.object({ reference: z.string().max(120).optional() })

// Marca el pago a un socio como pagado, con el folio de la transferencia.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = bodySchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ message: "Parámetros inválidos" })
    return
  }
  const ledger: LedgerModuleService = req.scope.resolve(LEDGER_MODULE)
  try {
    res.json({ payout: await payPayout(ledger, req.params.id, parsed.data.reference ?? null) })
  } catch (error) {
    const type = error instanceof MedusaError ? error.type : undefined
    const status = type === MedusaError.Types.NOT_FOUND ? 404 : type === MedusaError.Types.NOT_ALLOWED ? 409 : 400
    res.status(status).json({ message: (error as Error).message })
  }
}
