import { MedusaService } from "@medusajs/framework/utils"

import BillingDocument from "./models/billing-document"

class BillingModuleService extends MedusaService({
  BillingDocument,
}) {}

export default BillingModuleService
