import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { INTCOMEX_MODULE } from "../../../../modules/intcomex"
import type IntcomexModuleService from "../../../../modules/intcomex/service"

// Lista de productos de Intcomex ya sincronizados. Con ?unmapped=true devuelve los que ninguna
// regla de categoría reconoció (quedan en borrador hasta que se agregue la regla).
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: IntcomexModuleService = req.scope.resolve(INTCOMEX_MODULE)
  const { unmapped, limit = "50", offset = "0" } = req.query as Record<string, string | undefined>

  const take = Math.min(Math.max(Number(limit) || 50, 1), 200)
  const skip = Math.max(Number(offset) || 0, 0)
  const filters = unmapped === "true" ? { active: true, category_handle: null } : { active: true }

  const [products, count] = await service.listAndCountIntcomexProducts(filters, {
    take,
    skip,
    order: { sku: "ASC" },
  })
  res.json({ products, count, limit: take, offset: skip })
}
