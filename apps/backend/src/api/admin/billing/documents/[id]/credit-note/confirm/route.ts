import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import { confirmManualCreditNote } from "../../../../../../../modules/billing/operations"
import { billingDeps } from "../../../../../../../modules/billing/runtime"

const bodySchema = z.object({
  // Folio de la nota de crédito que se emitió en el portal del SII.
  folio: z.coerce.number().int().positive(),
  // AAAA-MM-DD; por defecto, hoy.
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

// Registra la nota de crédito que una persona emitió a mano en el portal del SII para anular una boleta. Solo aplica cuando
// la boleta se emitió con el servicio de boletas de Garage360, que no emite notas de crédito por API.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = bodySchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ message: "Indica el folio de la nota de crédito (un número) y, si quieres, la fecha AAAA-MM-DD." })
    return
  }
  const result = await confirmManualCreditNote(billingDeps(req.scope), req.params.id, parsed.data.folio, parsed.data.date)
  res.status(result.ok ? 200 : 422).json(result)
}
