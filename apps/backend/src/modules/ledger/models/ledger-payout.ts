import { model } from "@medusajs/framework/utils"

// Pago a un socio por un período cerrado.
const LedgerPayout = model
  .define("ledger_payout", {
    id: model.id({ prefix: "ledpay" }).primaryKey(),
    period: model.text(),
    // a | b
    partner: model.text(),
    partner_name: model.text(),
    percent: model.float(),
    amount: model.float(),
    // pending | paid
    status: model.text().default("pending"),
    paid_at: model.dateTime().nullable(),
    // Folio de la transferencia u otro comprobante.
    reference: model.text().nullable(),
  })
  .indexes([{ on: ["period"] }])

export default LedgerPayout
