import type { MedusaContainer } from "@medusajs/framework/types"

import { INTCOMEX_MODULE } from "../modules/intcomex"
import type IntcomexModuleService from "../modules/intcomex/service"
import { isSyncRunning, shouldRunScheduled, syncCatalog } from "../modules/intcomex/sync/run"

// Catálogo completo una vez al día (recomendación de Intcomex), de madrugada.
export default async function intcomexSyncCatalog(container: MedusaContainer) {
  if (!shouldRunScheduled()) {
    return
  }
  const service: IntcomexModuleService = container.resolve(INTCOMEX_MODULE)
  if (await isSyncRunning(service, "catalog")) {
    return
  }
  await syncCatalog(container)
}

export const config = {
  name: "intcomex-sync-catalog",
  schedule: "0 3 * * *",
}
