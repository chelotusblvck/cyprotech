import { model } from "@medusajs/framework/utils"

// Pedido de un cliente de la tienda colocado en Intcomex. Guarda también el snapshot de
// precios por línea (costo, TC, margen), que es la base del ledger de socios.
const IntcomexOrder = model
  .define("intcomex_order", {
    id: model.id({ prefix: "icxo" }).primaryKey(),
    medusa_order_id: model.text().unique(),
    // Número de pedido del cliente que se envía a Intcomex (CustomerOrderNumber).
    customer_order_number: model.text().unique(),
    intcomex_order_number: model.text().nullable(),
    // pending | placed | failed | canceled
    state: model.text().default("pending"),
    status_code: model.number().nullable(),
    status_description: model.text().nullable(),
    tracking: model.json().nullable(),
    price_snapshots: model.json().nullable(),
    request_payload: model.json().nullable(),
    response_payload: model.json().nullable(),
    error: model.text().nullable(),
    placed_at: model.dateTime().nullable(),
    last_status_check_at: model.dateTime().nullable(),
    // Se marcan cuando se avisó al cliente por correo, para no repetir el aviso.
    shipped_notified_at: model.dateTime().nullable(),
    delivered_notified_at: model.dateTime().nullable(),
  })
  .indexes([{ on: ["state"] }, { on: ["intcomex_order_number"] }])

export default IntcomexOrder
