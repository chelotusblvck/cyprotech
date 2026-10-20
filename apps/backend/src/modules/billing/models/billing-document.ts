import { model } from "@medusajs/framework/utils"

// Documento tributario electrónico de un pedido (boleta, factura o nota de crédito).
const BillingDocument = model
  .define("billing_document", {
    id: model.id({ prefix: "bild" }).primaryKey(),
    medusa_order_id: model.text(),
    // boleta | factura | nota_credito
    kind: model.text(),
    // 39 | 33 | 61
    tipo_dte: model.number(),
    // pending | issued | failed
    state: model.text().default("pending"),
    folio: model.number().nullable(),
    // Token de OpenFactura: identifica el documento y se usa para pedir el PDF y el estado.
    token: model.text().nullable(),
    // Aceptado | Pendiente | Rechazado | Aceptado con Reparo
    sii_status: model.text().nullable(),
    total: model.float(),
    receptor: model.json().nullable(),
    // Líneas del documento con IVA, tal como se cobraron. Sirven para anularlo con una nota de crédito.
    lines: model.json().nullable(),
    emission_date: model.text().nullable(),
    attempts: model.number().default(0),
    first_attempt_at: model.dateTime().nullable(),
    last_attempt_at: model.dateTime().nullable(),
    last_error: model.text().nullable(),
    // Si el error no se arregla reintentando (datos inválidos), requiere revisión manual.
    retryable: model.boolean().default(true),
    issued_at: model.dateTime().nullable(),
    // Se marca cuando se envió el correo con el documento al cliente.
    emailed_at: model.dateTime().nullable(),
    // Para una nota de crédito: el documento que anula.
    voids_document_id: model.text().nullable(),
  })
  .indexes([
    { on: ["medusa_order_id"] },
    { on: ["token"] },
    { on: ["state", "kind"] },
  ])

export default BillingDocument
