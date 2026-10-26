import type { MedusaContainer } from "@medusajs/framework/types"

import { buildOrderEmailData } from "../emails/order-data"
import { brandOverrides, loadOrderForEmail, sendEmail } from "../emails/send"
import type { TransferEmailData } from "../emails/templates"
import { loadTransferConfig, transferDeadline } from "./config"

const deadlineLabel = (date: Date) =>
  new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", timeZone: "America/Santiago" }).format(date)

// Instrucciones de pago al cliente que eligio transferencia: datos bancarios y plazo.
export const sendTransferInstructions = async (container: MedusaContainer, orderId: string): Promise<boolean> => {
  const order = await loadOrderForEmail(container, orderId)
  if (!order.email) {
    return false
  }
  const config = loadTransferConfig()
  const data: TransferEmailData = {
    ...buildOrderEmailData(order, brandOverrides()),
    bank: config.bank,
    deadline: deadlineLabel(transferDeadline(order.created_at, config.deadlineHours)),
  }
  return sendEmail(container, { to: order.email, template: "order-awaiting-transfer", data })
}
