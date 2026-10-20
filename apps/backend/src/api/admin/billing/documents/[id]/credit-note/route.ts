import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import { issueCreditNote } from "../../../../../../modules/billing/operations"
import { billingDeps } from "../../../../../../modules/billing/runtime"

const bodySchema = z.object({ reason: z.string().min(3).max(90).default("Anula documento por devolución") })

// Anula un documento emitido con una nota de crédito. Es una acción tributaria: queda registrada y
// no se puede repetir para el mismo documento.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = bodySchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ message: "Indica el motivo (entre 3 y 90 caracteres)." })
    return
  }
  const result = await issueCreditNote(billingDeps(req.scope), req.params.id, parsed.data.reason)
  res.status(result.ok ? 200 : 422).json(result)
}
