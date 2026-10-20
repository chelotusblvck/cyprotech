import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"

import { createFlowApi, FLOW_STATUS, type FlowApi } from "./client"
import { mapFlowStatus, sessionIdFrom, type FlowSessionData } from "./payment-data"

export type SettleResult = {
  // paid | pending | rejected | canceled | unknown (token que no corresponde a un pago vigente)
  state: "paid" | "pending" | "rejected" | "canceled" | "unknown"
  cartId?: string
  orderId?: string
  error?: string
}

type Row = { id: string; data: FlowSessionData; cart_id: string }

// Verifica el pago con Flow y, si está pagado, completa el carrito para crear el pedido.
// Lo llaman el aviso de Flow (urlConfirmation) y la consulta de la tienda al volver, así que
// es idempotente: si el pedido ya existe, lo devuelve sin crear otro. Nunca se confía en lo que
// llega por el navegador; el estado siempre se consulta a la API de Flow con el token.
export const settleFlowPayment = async (
  container: MedusaContainer,
  token: string,
  api: FlowApi = createFlowApi(),
): Promise<SettleResult> => {
  const flow = await api.getPaymentStatus(token)
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const { rows } = (await pg.raw(
    `select s.id, s.data, l.cart_id
       from payment_session s
       join cart_payment_collection l on l.payment_collection_id = s.payment_collection_id
      where s.id = ? and s.deleted_at is null and l.deleted_at is null`,
    [sessionIdFrom(flow.commerceOrder)],
  )) as { rows: Row[] }
  const session = rows[0]
  if (!session) {
    return { state: "unknown" }
  }

  // Una orden de Flow anterior (el carrito cambió de monto y se creó otra) no confirma nada.
  if (session.data.flowToken !== token) {
    return { state: "unknown", cartId: session.cart_id }
  }

  const status = mapFlowStatus(flow.status)
  if (flow.status !== FLOW_STATUS.PAID) {
    const state = status === "error" ? "rejected" : status === "canceled" ? "canceled" : "pending"
    return { state, cartId: session.cart_id }
  }

  const existing = (await pg.raw(`select order_id from order_cart where cart_id = ? and deleted_at is null`, [
    session.cart_id,
  ])) as { rows: { order_id: string }[] }
  if (existing.rows[0]) {
    return { state: "paid", cartId: session.cart_id, orderId: existing.rows[0].order_id }
  }

  const { result, errors } = await completeCartWorkflow(container).run({
    input: { id: session.cart_id },
    throwOnError: false,
  })
  if (errors?.length) {
    // Dos avisos casi simultáneos pueden competir: si el otro ya creó el pedido, se devuelve ese.
    const retry = (await pg.raw(`select order_id from order_cart where cart_id = ? and deleted_at is null`, [
      session.cart_id,
    ])) as { rows: { order_id: string }[] }
    if (retry.rows[0]) {
      return { state: "paid", cartId: session.cart_id, orderId: retry.rows[0].order_id }
    }
    return {
      state: "paid",
      cartId: session.cart_id,
      error: errors.map((entry: { error?: { message?: string } }) => entry.error?.message ?? "error").join("; "),
    }
  }
  return { state: "paid", cartId: session.cart_id, orderId: (result as { id?: string } | undefined)?.id }
}
