import { model } from "@medusajs/framework/utils"

// Tipo de cambio USD -> CLP por día. Cada orden toma el valor vigente al comprar.
const IntcomexFxRate = model.define("intcomex_fx_rate", {
  id: model.id({ prefix: "icxf" }).primaryKey(),
  // AAAA-MM-DD
  date: model.text().unique(),
  rate: model.float(),
  source: model.text(),
})

export default IntcomexFxRate
