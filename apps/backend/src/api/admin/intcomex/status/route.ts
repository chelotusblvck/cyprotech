import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { loadPricingConfig } from "../../../../lib/pricing"
import { loadIntcomexConfig } from "../../../../modules/intcomex/client"
import { INTCOMEX_MODULE } from "../../../../modules/intcomex"
import type IntcomexModuleService from "../../../../modules/intcomex/service"
import { minStockFromEnv } from "../../../../modules/intcomex/sync/run"

const KINDS = ["catalog", "prices", "inventory"] as const

// Estado de la integración para el dashboard: credenciales, últimas sincronizaciones,
// conteos del catálogo, tipo de cambio vigente y pedidos por estado.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: IntcomexModuleService = req.scope.resolve(INTCOMEX_MODULE)
  const config = loadIntcomexConfig()
  const minStock = minStockFromEnv()

  const count = async (filters: Record<string, unknown>) =>
    (await service.listAndCountIntcomexProducts(filters, { take: 1 }))[1]

  const [total, active, unmapped, lowStock] = await Promise.all([
    count({}),
    count({ active: true }),
    count({ active: true, category_handle: null }),
    count({ active: true, stock: { $lt: minStock } }),
  ])

  const lastRuns = Object.fromEntries(
    await Promise.all(
      KINDS.map(async (kind) => {
        const [run] = await service.listIntcomexSyncRuns({ kind }, { order: { started_at: "DESC" }, take: 1 })
        return [kind, run ?? null] as const
      }),
    ),
  )

  const [fx] = await service.listIntcomexFxRates({}, { order: { date: "DESC" }, take: 1 })

  const orders = await service.listIntcomexOrders({}, { select: ["id", "state"] })
  const ordersByState = orders.reduce<Record<string, number>>((acc, order) => {
    acc[order.state] = (acc[order.state] ?? 0) + 1
    return acc
  }, {})

  res.json({
    integration: {
      configured: config !== null,
      mode: config ? "real" : "simulado",
      environment: config?.environment ?? null,
      autoPlaceOrders: process.env.INTCOMEX_AUTO_PLACE_ORDERS === "true",
      verifyAtCheckout: process.env.INTCOMEX_VERIFY_AT_CHECKOUT !== "false",
    },
    pricing: { ...loadPricingConfig(), minStock },
    fx: fx ?? null,
    catalog: { total, active, unmapped, lowStock },
    lastRuns,
    ordersByState,
  })
}
