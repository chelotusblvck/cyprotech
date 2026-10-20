import { model } from "@medusajs/framework/utils"

// Bitácora de cada sincronización con Intcomex, visible en el dashboard.
const IntcomexSyncRun = model
  .define("intcomex_sync_run", {
    id: model.id({ prefix: "icxs" }).primaryKey(),
    // catalog | prices | inventory | order-status
    kind: model.text(),
    // running | success | failed
    status: model.text().default("running"),
    mock: model.boolean().default(false),
    started_at: model.dateTime(),
    finished_at: model.dateTime().nullable(),
    stats: model.json().nullable(),
    error: model.text().nullable(),
  })
  .indexes([{ on: ["kind", "started_at"] }])

export default IntcomexSyncRun
