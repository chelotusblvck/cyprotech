import { MedusaService } from "@medusajs/framework/utils"

import IntcomexFxRate from "./models/intcomex-fx-rate"
import IntcomexOrder from "./models/intcomex-order"
import IntcomexProduct from "./models/intcomex-product"
import IntcomexSyncRun from "./models/intcomex-sync-run"

class IntcomexModuleService extends MedusaService({
  IntcomexProduct,
  IntcomexOrder,
  IntcomexFxRate,
  IntcomexSyncRun,
}) {}

export default IntcomexModuleService
