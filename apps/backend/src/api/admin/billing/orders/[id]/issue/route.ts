import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import { issueDocument } from "../../../../../../modules/billing/operations"
import { billingDeps, loadOrderForBilling } from "../../../../../../modules/billing/runtime"

const bodySchema = z.object({ force: z.boolean().optional() })

// Emite (o reintenta) a mano el documento de un pedido. Es idempotente: si ya está emitido devuelve el
// existente. "force" solo se usa tras revisar en OpenFactura que el documento no se emitió antes.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = bodySchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ message: "Parámetros inválidos" })
    return
  }
  const order = await loadOrderForBilling(req.scope, req.params.id)
  if (!order) {
    res.status(404).json({ message: `No existe el pedido ${req.params.id}` })
    return
  }
  const result = await issueDocument(billingDeps(req.scope), order, { force: parsed.data.force })
  res.status(result.ok ? 200 : 422).json(result)
}
