import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { LEDGER_MODULE } from "../modules/ledger"
import { DEFAULT_SETTINGS } from "../modules/ledger/logic"
import { saveSettings } from "../modules/ledger/operations"
import type LedgerModuleService from "../modules/ledger/service"

// SOLO DESARROLLO. Borra todos los pedidos de prueba, sus registros en Intcomex y el ledger,
// y restablece la configuración del reparto. No toca productos ni clientes.
export default async function devCleanDemo({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const orders = container.resolve(Modules.ORDER)
  const ledger: LedgerModuleService = container.resolve(LEDGER_MODULE)

  const { data } = await query.graph({ entity: "order", fields: ["id", "metadata"] })
  const ids = data
    .filter((order: { metadata?: Record<string, unknown> | null }) => order.metadata?.demo === true || order.metadata?.rut)
    .map((order: { id: string }) => order.id)
  // El pedido de la prueba de colocación (sin marca demo) también se elimina.
  const stray = data.map((order: { id: string }) => order.id).filter((id: string) => !ids.includes(id))
  const all = [...ids, ...stray]
  if (all.length) {
    await orders.deleteOrders(all)
  }

  for (const table of ["ledger_payout", "ledger_entry", "ledger_period", "ledger_order", "intcomex_order", "billing_document"]) {
    await pg.raw(`delete from ${table}`)
  }
  await saveSettings(ledger, DEFAULT_SETTINGS)
  logger.info(`Limpieza lista: ${all.length} pedido(s) eliminados, ledger, documentos tributarios y registros de Intcomex vaciados.`)
}
