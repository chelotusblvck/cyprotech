import type { MedusaContainer } from "@medusajs/framework/types"

import { pollOrderStatuses } from "../modules/intcomex/orders/status"
import { shouldRunScheduled } from "../modules/intcomex/sync/run"

// Estado y seguimiento de los pedidos colocados en Intcomex, cada 30 minutos.
export default async function intcomexPollOrders(container: MedusaContainer) {
  if (!shouldRunScheduled()) {
    return
  }
  await pollOrderStatuses(container)
}

export const config = {
  name: "intcomex-poll-orders",
  schedule: "*/30 * * * *",
}
