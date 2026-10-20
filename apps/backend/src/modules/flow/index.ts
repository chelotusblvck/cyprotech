import { ModuleProvider, Modules } from "@medusajs/framework/utils"

import FlowPaymentProviderService from "./provider"

export default ModuleProvider(Modules.PAYMENT, {
  services: [FlowPaymentProviderService],
})
