import { Module } from "@medusajs/framework/utils"

import IntcomexModuleService from "./service"

export const INTCOMEX_MODULE = "intcomex"

export default Module(INTCOMEX_MODULE, {
  service: IntcomexModuleService,
})
