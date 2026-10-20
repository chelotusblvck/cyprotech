import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"

import { loadFlowUrls } from "../../modules/flow/client/config"
import { buildOrderEmailData, ORDER_EMAIL_FIELDS, type OrderForEmail } from "./order-data"
import type { OrderEmailData, TemplateName } from "./templates"

export type Attachment = { filename: string; content: string; content_type: string }

export const brandOverrides = () => ({
  storefrontUrl: loadFlowUrls().storefrontUrl,
  supportEmail: process.env.SUPPORT_EMAIL?.trim() || "contacto@cyprotech.cl",
})

// Envía un correo por el canal "email". Nunca interrumpe el flujo que lo llamó: si el envío falla
// (SMTP caído, mal configurado) se registra el error y se sigue, porque un correo perdido no
// debe tumbar una venta. Devuelve si se pudo enviar.
export const sendEmail = async (
  container: MedusaContainer,
  input: { to: string; template: TemplateName; data: unknown; attachments?: Attachment[] },
): Promise<boolean> => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const notifications = container.resolve(Modules.NOTIFICATION)
    await notifications.createNotifications({
      to: input.to,
      channel: "email",
      template: input.template,
      data: input.data as Record<string, unknown>,
      attachments: input.attachments,
    })
    return true
  } catch (error) {
    logger.error(`No se pudo enviar el correo "${input.template}" a ${input.to}: ${(error as Error).message}`)
    return false
  }
}

export const loadOrderForEmail = async (container: MedusaContainer, orderId: string): Promise<OrderForEmail> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [order],
  } = await query.graph({ entity: "order", fields: ORDER_EMAIL_FIELDS, filters: { id: orderId } })
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `No existe el pedido ${orderId}`)
  }
  return order as unknown as OrderForEmail
}

// Correo de un pedido (confirmación, despacho, entrega) al cliente que lo hizo.
export const sendOrderEmail = async (
  container: MedusaContainer,
  orderId: string,
  template: Extract<TemplateName, "order-confirmed" | "order-shipped" | "order-delivered">,
  extra: Pick<Parameters<typeof buildOrderEmailData>[1], "document" | "tracking"> = {},
) => {
  const order = await loadOrderForEmail(container, orderId)
  if (!order.email) {
    return false
  }
  const data: OrderEmailData = buildOrderEmailData(order, { ...brandOverrides(), ...extra })
  return sendEmail(container, { to: order.email, template, data })
}

// Aviso interno al equipo (fallas de boleta, pedidos que no se colocan, etc.). Solo se envía si
// ALERT_EMAIL está configurado.
export const sendAlert = async (
  container: MedusaContainer,
  alert: { title: string; message: string; details?: string[]; actionPath?: string },
) => {
  const to = process.env.ALERT_EMAIL?.trim()
  if (!to) {
    return false
  }
  const backend = loadFlowUrls().backendUrl
  return sendEmail(container, {
    to,
    template: "internal-alert",
    data: {
      brand: brandOverrides(),
      title: alert.title,
      message: alert.message,
      details: alert.details,
      actionLabel: "Abrir el dashboard",
      actionUrl: `${backend}/app${alert.actionPath ?? "/cyprotech"}`,
    },
  })
}
