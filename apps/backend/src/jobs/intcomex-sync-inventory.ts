import type { MedusaContainer } from "@medusajs/framework/types"

import { INTCOMEX_MODULE } from "../modules/intcomex"
import type IntcomexModuleService from "../modules/intcomex/service"
import { isSyncRunning, shouldRunScheduled, syncInventory } from "../modules/intcomex/sync/run"

// Disponibilidad cada hora (recomendación de Intcomex). Oculta productos bajo el stock mínimo.
export default async function intcomexSyncInventory(container: MedusaContainer) {
  if (!shouldRunScheduled()) {
    return
  }
  const service: IntcomexModuleService = container.resolve(INTCOMEX_MODULE)
  if (await isSyncRunning(service, "inventory", 1)) {
    return
  }
  await syncInventory(container)
}

export const config = {
  name: "intcomex-sync-inventory",
  schedule: "15 * * * *",
}
