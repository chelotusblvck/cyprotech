import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createOrdersWorkflow } from "@medusajs/medusa/core-flows"

import { INTCOMEX_MODULE } from "../modules/intcomex"
import type IntcomexModuleService from "../modules/intcomex/service"
import { LEDGER_MODULE } from "../modules/ledger"
import { DEFAULT_SETTINGS } from "../modules/ledger/logic"
import {
  addManualEntry,
  closePeriod,
  markDelivered,
  releaseDueOrders,
  saveSettings,
} from "../modules/ledger/operations"
import type LedgerModuleService from "../modules/ledger/service"
import { placeIntcomexOrderWorkflow } from "../workflows/place-intcomex-order"

// SOLO DESARROLLO. Crea pedidos de muestra repartidos en varias semanas y meses para ver el
// dashboard y el ledger con datos. Se limpian con dev-clean-demo.ts.
const day = (iso: string) => new Date(`${iso}T15:00:00Z`)

type Plan = {
  created: string
  skus: [string, number][]
  place: boolean
  delivered?: string
  releaseAt?: string
}

const PLANS: Plan[] = [
  { created: "2026-09-08", skus: [["MK001GPU02", 1]], place: true, delivered: "2026-09-12", releaseAt: "2026-09-25" },
  { created: "2026-09-15", skus: [["MK011MS01", 2], ["MK010KB01", 1]], place: true, delivered: "2026-09-18", releaseAt: "2026-09-29" },
  { created: "2026-09-27", skus: [["MK020RT01", 3]], place: true, delivered: "2026-09-30", releaseAt: "2026-10-12" },
  { created: "2026-10-03", skus: [["MK009MON01", 1]], place: true, delivered: "2026-10-06", releaseAt: "2026-10-17" },
  { created: "2026-10-12", skus: [["MK030CAM01", 4], ["MK031NVR01", 1]], place: true },
  { created: "2026-10-16", skus: [["MK002CPU01", 1]], place: true, delivered: "2026-10-18" },
  { created: "2026-10-19", skus: [["MK012HP02", 2]], place: false },
]

export default async function devSeedLedgerDemo({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const intcomex: IntcomexModuleService = container.resolve(INTCOMEX_MODULE)
  const ledger: LedgerModuleService = container.resolve(LEDGER_MODULE)

  // Comisión de ejemplo solo para ver el cálculo; se restablece al limpiar.
  await saveSettings(ledger, { ...DEFAULT_SETTINGS, gatewayFeePercent: 3.19 })

  const {
    data: [region],
  } = await query.graph({ entity: "region", fields: ["id"], filters: { name: "Chile" } })
  const {
    data: [store],
  } = await query.graph({ entity: "store", fields: ["default_sales_channel_id"] })

  for (const [index, plan] of PLANS.entries()) {
    const rows = await intcomex.listIntcomexProducts({ sku: plan.skus.map(([sku]) => sku) })
    const bySku = new Map(rows.map((row) => [row.sku, row]))
    const santiago = index % 3 !== 0

    const { result: order } = await createOrdersWorkflow(container).run({
      input: {
        region_id: region.id,
        email: `cliente${index + 1}.demo@example.com`,
        currency_code: "clp",
        sales_channel_id: store.default_sales_channel_id as string,
        shipping_address: {
          first_name: ["Ana", "Luis", "Marta", "Pedro", "Sofía", "Diego", "Carla"][index],
          last_name: "Demo",
          address_1: `Calle Ejemplo ${100 + index}`,
          city: santiago ? "Santiago" : "Valparaíso",
          province: santiago ? "Región Metropolitana" : "Valparaíso",
          postal_code: "8320000",
          country_code: "cl",
          phone: "+56911112222",
        },
        items: plan.skus.map(([sku, quantity]) => {
          const row = bySku.get(sku)!
          return {
            variant_id: row.medusa_variant_id as string,
            title: row.description,
            quantity,
            unit_price: row.public_price as number,
          }
        }),
        shipping_methods: [{ name: santiago ? "Despacho Santiago" : "Despacho Regiones", amount: santiago ? 2900 : 5700 }],
        metadata: { demo: true },
      },
    })

    await pg.raw(`update "order" set created_at = ?, updated_at = ? where id = ?`, [day(plan.created), day(plan.created), order.id])

    if (!plan.place) {
      continue
    }
    await placeIntcomexOrderWorkflow(container).run({ input: { orderId: order.id } })
    await pg.raw(`update intcomex_order set created_at = ?, placed_at = ? where medusa_order_id = ?`, [day(plan.created), day(plan.created), order.id])
    await pg.raw(`update ledger_order set created_at = ? where medusa_order_id = ?`, [day(plan.created), order.id])

    if (plan.delivered) {
      await markDelivered(ledger, order.id, day(plan.delivered))
      if (plan.releaseAt) {
        await releaseDueOrders(ledger, day(plan.releaseAt))
      }
    }
  }

  // Septiembre ya terminó: se cierra con un gasto de hosting además del costo fijo del facturador.
  await addManualEntry(ledger, { kind: "expense", amount: 15000, description: "Hosting VPS (septiembre)", period: "2026-09" })
  await closePeriod(ledger, "2026-09", { now: day("2026-10-20") })
  // Octubre sigue abierto.
  await addManualEntry(ledger, { kind: "expense", amount: 15000, description: "Hosting VPS (octubre)" }, day("2026-10-20"))

  logger.info("Datos de muestra del ledger creados.")
}
