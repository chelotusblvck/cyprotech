import { MedusaService } from "@medusajs/framework/utils"

import LedgerEntry from "./models/ledger-entry"
import LedgerOrder from "./models/ledger-order"
import LedgerPayout from "./models/ledger-payout"
import LedgerPeriod from "./models/ledger-period"
import LedgerSetting from "./models/ledger-setting"

class LedgerModuleService extends MedusaService({
  LedgerSetting,
  LedgerOrder,
  LedgerEntry,
  LedgerPeriod,
  LedgerPayout,
}) {}

export default LedgerModuleService
