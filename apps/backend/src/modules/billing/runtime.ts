import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { brandOverrides, sendAlert, sendEmail } from "../../lib/emails/send"
import { toNumber } from "../../lib/numbers"
import { orderNumber } from "../../lib/emails/order-data"
import { loadFlowUrls } from "../flow/client/config"
import { createOpenFacturaApi, loadEmisor, MOCK_EMISOR } from "./client"
import type { BillingDeps } from "./operations"
import { BILLING_MODULE } from "./index"
import type BillingModuleService from "./service"
import { DTE_LABEL, documentFileName, type OrderForBilling } from "./types"

export const documentUrl = (token: string) => `${loadFlowUrls().backendUrl}/documents/${token}`

export const loadOrderForBilling = async (
  container: MedusaContainer,
  orderId: string,
): Promise<(OrderForBilling & { display_id?: number | null }) | null> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "created_at",
      "total",
      "shipping_total",
      "metadata",
      "items.title",
      "items.product_title",
      "items.quantity",
      "items.unit_price",
      "items.total",
      "shipping_address.first_name",
      "shipping_address.last_name",
    ],
    filters: { id: orderId },
  })
  if (!order) {
    return null
  }
  const raw = order as unknown as OrderForBilling
  return {
    ...raw,
    total: toNumber(raw.total),
    shipping_total: toNumber(raw.shipping_total),
    items: (raw.items ?? []).map((item) => ({
      ...item,
      quantity: toNumber(item.quantity),
      unit_price: toNumber(item.unit_price),
      total: toNumber(item.total),
    })),
  }
}

// Envía al cliente el correo con su boleta o factura (PDF adjunto y enlace de descarga). Si el PDF
// no se puede obtener en ese momento, el correo sale igual con el enlace.
export const sendDocumentEmail = async (container: MedusaContainer, documentId: string) => {
  const service: BillingModuleService = container.resolve(BILLING_MODULE)
  const [doc] = await service.listBillingDocuments({ id: documentId })
  if (!doc || doc.state !== "issued" || !doc.token || !doc.folio) {
    return false
  }
  const order = await loadOrderForBilling(container, doc.medusa_order_id)
  if (!order?.email) {
    return false
  }

  const label = DTE_LABEL[doc.tipo_dte] ?? "Documento"
  let attachments: { filename: string; content: string; content_type: string }[] | undefined
  try {
    const pdf = await createOpenFacturaApi().getPdf(doc.token)
    attachments = [
      {
        filename: documentFileName(doc.tipo_dte, doc.folio),
        content: pdf.toString("base64"),
        content_type: "application/pdf",
      },
    ]
  } catch {
    // Sigue sin adjunto: el cliente puede descargarlo con el enlace.
  }

  const { storefrontUrl } = brandOverrides()
  const customerName = (order as { shipping_address?: { first_name?: string | null; last_name?: string | null } })
    .shipping_address
  const sent = await sendEmail(container, {
    to: order.email,
    template: "document-ready",
    attachments,
    data: {
      brand: brandOverrides(),
      orderNumber: orderNumber(order),
      customerName: [customerName?.first_name, customerName?.last_name].filter(Boolean).join(" ") || "cliente",
      documentLabel: label,
      folio: doc.folio,
      total: doc.total,
      documentUrl: documentUrl(doc.token),
      orderUrl: `${storefrontUrl}/cl/order/${order.id}/confirmed`,
    },
  })
  if (sent) {
    await service.updateBillingDocuments({ id: doc.id, emailed_at: new Date() })
  }
  return sent
}

// Todo lo que necesitan las operaciones de boletas, ya conectado al sistema real: el cliente de
// OpenFactura (o el simulado), los datos del emisor y los avisos por correo.
export const billingDeps = (container: MedusaContainer): BillingDeps => {
  const api = createOpenFacturaApi()
  return {
    service: container.resolve(BILLING_MODULE),
    api,
    emisor: loadEmisor() ?? (api.isMock ? MOCK_EMISOR : null),
    onIssued: async (documentId) => {
      await sendDocumentEmail(container, documentId)
    },
    onFailed: async (documentId, error, retryable) => {
      const service: BillingModuleService = container.resolve(BILLING_MODULE)
      const [doc] = await service.listBillingDocuments({ id: documentId })
      await sendAlert(container, {
        title: `No se pudo emitir el documento del pedido ${doc?.medusa_order_id ?? ""}`.trim(),
        message: retryable
          ? "Falló la emisión y se reintentará automáticamente."
          : "Falló la emisión y no se arreglará sola: hay que revisarlo a mano.",
        details: [`Motivo: ${error}`, `Intentos: ${doc?.attempts ?? 1}`],
        actionPath: "/cyprotech",
      })
    },
  }
}
