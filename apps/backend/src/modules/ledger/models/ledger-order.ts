import { model } from "@medusajs/framework/utils"

// Ciclo de vida de la utilidad de un pedido: pending (colocado en Intcomex) -> earned (entregado
// y vencido el plazo de retracto) o void/reversed si se cancela o devuelve.
const LedgerOrder = model
  .define("ledger_order", {
    id: model.id({ prefix: "ledord" }).primaryKey(),
    medusa_order_id: model.text().unique(),
    display_id: model.text(),
    // pending | earned | reversed | void
    state: model.text().default("pending"),
    // Margen y comisión calculados al colocar el pedido (ver OrderEconomics).
    economics: model.json(),
    delivered_at: model.dateTime().nullable(),
    earned_at: model.dateTime().nullable(),
    reversed_at: model.dateTime().nullable(),
    period: model.text().nullable(),
  })
  .indexes([{ on: ["state"] }, { on: ["period"] }])

export default LedgerOrder
