import { model } from "@medusajs/framework/utils"

// Cierre mensual. Al cerrar se congelan los totales y se generan los pagos a los socios.
const LedgerPeriod = model.define("ledger_period", {
  id: model.id({ prefix: "ledper" }).primaryKey(),
  // AAAA-MM
  period: model.text().unique(),
  // open | closed
  status: model.text().default("open"),
  totals: model.json().nullable(),
  // Pérdida que llega del período anterior y la que se arrastra al siguiente.
  deficit_in: model.float().default(0),
  deficit_out: model.float().default(0),
  closed_at: model.dateTime().nullable(),
})

export default LedgerPeriod
