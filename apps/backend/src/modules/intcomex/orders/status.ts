import type { MedusaContainer } from "@medusajs/framework/types"

import { sendOrderEmail } from "../../../lib/emails/send"
import type { TrackingInfo } from "../../../lib/emails/templates"
import { createIntcomexApi } from "../client"
import { IWS_ORDER_STATUS, type IntcomexApi } from "../client/types"
import { INTCOMEX_MODULE } from "../index"
import { LEDGER_MODULE } from "../../ledger"
import { markDelivered, reverseOrder } from "../../ledger/operations"
import type LedgerModuleService from "../../ledger/service"
import type IntcomexModuleService from "../service"

type Shipment = { CarrierId?: string; FreightService?: string; FreightShipmentId?: string }

const toTracking = (value: unknown): TrackingInfo[] =>
  (Array.isArray(value) ? (value as Shipment[]) : []).map((shipment) => ({
    carrier: shipment.CarrierId ?? shipment.FreightService ?? null,
    number: shipment.FreightShipmentId ?? null,
    url: null,
  }))

// Avisa al cliente por correo cuando el pedido sale (con su seguimiento) y cuando se entrega. Cada
// aviso se envía una sola vez: se marca solo si el correo salió, así un SMTP caído no lo pierde.
export const notifyCustomer = async (
  container: MedusaContainer,
  service: IntcomexModuleService,
  order: Awaited<ReturnType<IntcomexModuleService["listIntcomexOrders"]>>[number],
  statusCode: number,
  tracking: unknown,
) => {
  const canceled = statusCode === IWS_ORDER_STATUS.CANCELED
  const delivered = statusCode === IWS_ORDER_STATUS.DELIVERED
  if (canceled) {
    return
  }
  if (delivered && !order.delivered_notified_at) {
    if (await sendOrderEmail(container, order.medusa_order_id, "order-delivered")) {
      await service.updateIntcomexOrders({ id: order.id, delivered_notified_at: new Date() })
    }
    return
  }
  if (!delivered && statusCode >= IWS_ORDER_STATUS.READY_TO_DELIVER && !order.shipped_notified_at) {
    const sent = await sendOrderEmail(container, order.medusa_order_id, "order-shipped", {
      tracking: toTracking(tracking),
    })
    if (sent) {
      await service.updateIntcomexOrders({ id: order.id, shipped_notified_at: new Date() })
    }
  }
}

const FINAL_STATUSES: number[] = [IWS_ORDER_STATUS.CANCELED, IWS_ORDER_STATUS.DELIVERED]

// Consulta el estado en Intcomex de los pedidos colocados que aún no terminan y guarda
// el seguimiento cuando la orden ya está lista para entrega.
export const pollOrderStatuses = async (container: MedusaContainer, api: IntcomexApi = createIntcomexApi()) => {
  const service: IntcomexModuleService = container.resolve(INTCOMEX_MODULE)
  const ledger: LedgerModuleService = container.resolve(LEDGER_MODULE)
  const orders = await service.listIntcomexOrders({ state: "placed" })

  let checked = 0
  let changed = 0
  for (const order of orders) {
    if (!order.intcomex_order_number) {
      continue
    }
    if (order.status_code !== null && FINAL_STATUSES.includes(order.status_code)) {
      continue
    }
    checked++

    const status = await api.getOrderStatus(order.intcomex_order_number)
    const patch: Record<string, unknown> = {
      id: order.id,
      status_code: status.StatusCode,
      status_description: status.Description,
      last_status_check_at: new Date(),
    }

    // Desde "listo para entregar" Intcomex ya tiene datos de despacho.
    if (status.StatusCode >= IWS_ORDER_STATUS.READY_TO_DELIVER && !order.tracking) {
      const detail = await api.getOrder(order.intcomex_order_number)
      if (detail.Shipments?.length) {
        patch.tracking = detail.Shipments
      }
    }

    if (status.StatusCode !== order.status_code) {
      changed++
    }
    await service.updateIntcomexOrders(patch as { id: string })

    await notifyCustomer(container, service, order, status.StatusCode, (patch.tracking ?? order.tracking) as unknown)

    // La entrega inicia el plazo de retracto tras el cual la utilidad se reconoce en el ledger.
    if (status.StatusCode === IWS_ORDER_STATUS.DELIVERED) {
      await markDelivered(ledger, order.medusa_order_id)
    }
    if (status.StatusCode === IWS_ORDER_STATUS.CANCELED) {
      await reverseOrder(ledger, order.medusa_order_id)
    }
  }
  return { checked, changed }
}
