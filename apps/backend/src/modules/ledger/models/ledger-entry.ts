import { model } from "@medusajs/framework/utils"

// Asiento del libro. Solo se agregan, nunca se editan ni se borran: una corrección es otro
// asiento. El monto es CLP neto con signo (positivo suma utilidad, negativo la resta).
const LedgerEntry = model
  .define("ledger_entry", {
    id: model.id({ prefix: "lede" }).primaryKey(),
    // AAAA-MM
    period: model.text(),
    // margin | gateway_fee | reversal | expense | adjustment
    kind: model.text(),
    amount: model.float(),
    order_id: model.text().nullable(),
    description: model.text(),
    // Origen del asiento, para no duplicar los costos fijos (recurring:<nombre>).
    source: model.text().nullable(),
  })
  .indexes([{ on: ["period", "kind"] }, { on: ["order_id"] }])

export default LedgerEntry
