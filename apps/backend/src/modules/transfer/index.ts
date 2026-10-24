import { ModuleProvider, Modules } from "@medusajs/framework/utils"

import TransferPaymentProviderService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [TransferPaymentProviderService],
})
