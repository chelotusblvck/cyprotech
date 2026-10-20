import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { BILLING_MODULE } from "../../../../modules/billing"
import { documentUrl } from "../../../../modules/billing/runtime"
import type BillingModuleService from "../../../../modules/billing/service"

// Boletas, facturas y notas de crédito, con su estado de emisión y ante el SII. Filtros: ?state=failed
// y ?order_id=...
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: BillingModuleService = req.scope.resolve(BILLING_MODULE)
  const { state, order_id, limit = "50", offset = "0" } = req.query as Record<string, string | undefined>
  const take = Math.min(Math.max(Number(limit) || 50, 1), 200)
  const skip = Math.max(Number(offset) || 0, 0)

  const [documents, count] = await service.listAndCountBillingDocuments(
    { ...(state ? { state } : {}), ...(order_id ? { medusa_order_id: order_id } : {}) },
    { take, skip, order: { created_at: "DESC" } },
  )
  res.json({
    documents: documents.map((doc) => ({ ...doc, url: doc.token && doc.state === "issued" ? documentUrl(doc.token) : null })),
    count,
    limit: take,
    offset: skip,
  })
}
