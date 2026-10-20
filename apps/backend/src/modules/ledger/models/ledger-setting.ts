import { model } from "@medusajs/framework/utils"

// Configuración del reparto. Una sola fila ("default"), editable desde el dashboard.
const LedgerSetting = model.define("ledger_setting", {
  id: model.id({ prefix: "ledset" }).primaryKey(),
  key: model.text().unique().default("default"),
  partner_a_name: model.text(),
  partner_a_percent: model.float(),
  partner_b_name: model.text(),
  partner_b_percent: model.float(),
  gateway_fee_percent: model.float().default(0),
  gateway_fee_fixed: model.float().default(0),
  gateway_fee_reported_with_iva: model.boolean().default(false),
  hold_days: model.number().default(10),
  carry_deficit: model.boolean().default(true),
  fixed_costs: model.json().nullable(),
})

export default LedgerSetting
