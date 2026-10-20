import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { INTCOMEX_MODULE } from "../../../../modules/intcomex"
import type IntcomexModuleService from "../../../../modules/intcomex/service"

// Pedidos colocados (o que fallaron al colocarse) en Intcomex, con su snapshot de márgenes.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: IntcomexModuleService = req.scope.resolve(INTCOMEX_MODULE)
  const { state, limit = "50", offset = "0" } = req.query as Record<string, string | undefined>

  const take = Math.min(Math.max(Number(limit) || 50, 1), 200)
  const skip = Math.max(Number(offset) || 0, 0)

  const [orders, count] = await service.listAndCountIntcomexOrders(state ? { state } : {}, {
    take,
    skip,
    order: { created_at: "DESC" },
  })
  res.json({ orders, count, limit: take, offset: skip })
}
