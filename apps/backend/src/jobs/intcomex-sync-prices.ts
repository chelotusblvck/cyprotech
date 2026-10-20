import type { MedusaContainer } from "@medusajs/framework/types"

import { INTCOMEX_MODULE } from "../modules/intcomex"
import type IntcomexModuleService from "../modules/intcomex/service"
import { isSyncRunning, shouldRunScheduled, syncPrices } from "../modules/intcomex/sync/run"

// Lista de precios una vez al día, después del catálogo. También reaplica el tipo de cambio del día.
export default async function intcomexSyncPrices(container: MedusaContainer) {
  if (!shouldRunScheduled()) {
    return
  }
  const service: IntcomexModuleService = container.resolve(INTCOMEX_MODULE)
  if (await isSyncRunning(service, "prices")) {
    return
  }
  await syncPrices(container)
}

export const config = {
  name: "intcomex-sync-prices",
  schedule: "30 3 * * *",
}
