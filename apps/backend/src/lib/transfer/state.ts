import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { TRANSFER_PROVIDER_ID } from "./config"

export type TransferState = {
  // El pedido se paga por transferencia directa.
  isTransfer: boolean
  // El pago ya fue capturado (confirmado a mano en el admin).
  paid: boolean
  canceled: boolean
  createdAt: Date | null
}

type PaymentRow = { provider_id?: string | null; captured_at?: string | Date | null }
export type OrderRow = {
  status?: string | null
  created_at?: string | Date | null
  payment_collections?: { payments?: PaymentRow[] }[]
}

export const transferStateOf = (order: OrderRow | undefined): TransferState => {
  const payments = (order?.payment_collections ?? []).flatMap((collection) => collection.payments ?? [])
  const transfer = payments.filter((payment) => payment.provider_id === TRANSFER_PROVIDER_ID)
  return {
    isTransfer: transfer.length > 0,
    paid: transfer.some((payment) => Boolean(payment.captured_at)),
    canceled: order?.status === "canceled",
    createdAt: order?.created_at ? new Date(order.created_at) : null,
  }
}

export const loadTransferState = async (container: MedusaContainer, orderId: string): Promise<TransferState> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "status",
      "created_at",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.captured_at",
    ],
    filters: { id: orderId },
  })
  return transferStateOf(order as unknown as OrderRow | undefined)
}

// Pedido por transferencia que aun no recibe su pago: no se factura, no se confirma ni se compra a Intcomex.
export const isAwaitingTransfer = (state: TransferState) => state.isTransfer && !state.paid && !state.canceled
