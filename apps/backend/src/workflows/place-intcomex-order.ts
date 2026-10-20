import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { sendAlert } from "../lib/emails/send"
import { loadPricingConfig } from "../lib/pricing"
import { createIntcomexApi } from "../modules/intcomex/client"
import { INTCOMEX_MODULE } from "../modules/intcomex"
import { LEDGER_MODULE } from "../modules/ledger"
import type { LineSnapshot } from "../modules/ledger/logic"
import { recordPlacedOrder } from "../modules/ledger/operations"
import type LedgerModuleService from "../modules/ledger/service"
import {
  actualGatewayFee,
  buildIwsOrder,
  buildSnapshots,
  customerOrderNumber,
  type OrderForIntcomex,
} from "../modules/intcomex/orders/build-order"
import type IntcomexModuleService from "../modules/intcomex/service"
import { resolveUsdClp } from "../modules/intcomex/sync/fx"

type PlaceInput = { orderId: string }

export type PlaceResult = {
  ok: boolean
  alreadyPlaced?: boolean
  recordId?: string
  intcomexOrderNumber?: string | null
  error?: string
}

const loadOrderForIntcomexStep = createStep(
  "load-order-for-intcomex",
  async ({ orderId }: PlaceInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "total",
        "metadata",
        "items.id",
        "items.title",
        "items.quantity",
        "items.unit_price",
        "items.variant_sku",
        "shipping_address.*",
        "billing_address.*",
        "shipping_methods.name",
        "shipping_methods.amount",
        "payment_collections.payments.data",
      ],
      filters: { id: orderId },
    })
    if (!order) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `No existe el pedido ${orderId}`)
    }
    return new StepResponse(order as unknown as OrderForIntcomex)
  },
)

// Coloca el pedido en Intcomex una sola vez por pedido de la tienda. Si Intcomex lo rechaza,
// el intento queda registrado como "failed" con su error para resolverlo desde el dashboard
// (reintento, reembolso o reemplazo); no se pierde ni se reintenta a ciegas.
const placeOrderInIntcomexStep = createStep(
  "place-order-in-intcomex",
  async (order: OrderForIntcomex, { container }): Promise<StepResponse<PlaceResult>> => {
    const service: IntcomexModuleService = container.resolve(INTCOMEX_MODULE)
    const api = createIntcomexApi()
    const number = customerOrderNumber(order)

    const [existing] = await service.listIntcomexOrders({ medusa_order_id: order.id })
    if (existing?.state === "placed") {
      return new StepResponse({
        ok: true,
        alreadyPlaced: true,
        recordId: existing.id,
        intcomexOrderNumber: existing.intcomex_order_number,
      })
    }

    let request
    let snapshots
    try {
      const skus = (order.items ?? []).flatMap((item) => (item.variant_sku ? [item.variant_sku] : []))
      const rows = await service.listIntcomexProducts({ sku: skus })
      if (rows.length !== new Set(skus).size) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, "El pedido incluye productos que no son de Intcomex; se debe despachar por separado.")
      }

      const fx = await resolveUsdClp(service).catch(() => null)
      snapshots = buildSnapshots(order, rows, fx?.rate ?? null, loadPricingConfig())
      request = buildIwsOrder(order, {
        shipmentServiceType: process.env.INTCOMEX_SHIPMENT_SERVICE_TYPE || undefined,
      })
    } catch (error) {
      return new StepResponse(await failAndAlert(container, service, existing?.id, order.id, number, error as Error))
    }

    const record = existing
      ? await service.updateIntcomexOrders({
          id: existing.id,
          state: "pending",
          error: null,
          request_payload: request as unknown as Record<string, unknown>,
          price_snapshots: snapshots as unknown as Record<string, unknown>,
        })
      : await service.createIntcomexOrders({
          medusa_order_id: order.id,
          customer_order_number: number,
          state: "pending",
          request_payload: request as unknown as Record<string, unknown>,
          price_snapshots: snapshots as unknown as Record<string, unknown>,
        })

    try {
      const response = await api.placeOrder(request)
      await service.updateIntcomexOrders({
        id: record.id,
        state: "placed",
        intcomex_order_number: response.OrderNumber,
        response_payload: response as unknown as Record<string, unknown>,
        placed_at: new Date(),
        error: null,
      })
      return new StepResponse({ ok: true, recordId: record.id, intcomexOrderNumber: response.OrderNumber })
    } catch (error) {
      return new StepResponse(await failAndAlert(container, service, record.id, order.id, number, error as Error))
    }
  },
)

// Registra el fallo y avisa al equipo: un pedido cobrado que no llegó a Intcomex hay que resolverlo
// rápido (reintento, reembolso o reemplazo).
const failAndAlert = async (
  container: Parameters<typeof sendAlert>[0],
  service: IntcomexModuleService,
  recordId: string | undefined,
  medusaOrderId: string,
  number: string,
  error: Error,
): Promise<PlaceResult> => {
  const result = await saveFailure(service, recordId, medusaOrderId, number, error)
  await sendAlert(container, {
    title: `El pedido ${number} no se pudo colocar en Intcomex`,
    message: "El cliente ya pagó, pero Intcomex no recibió la orden. Hay que reintentarla, reembolsar o reemplazar.",
    details: [`Pedido: ${number}`, `Motivo: ${error.message}`],
  })
  return result
}

const saveFailure = async (
  service: IntcomexModuleService,
  recordId: string | undefined,
  medusaOrderId: string,
  number: string,
  error: Error,
): Promise<PlaceResult> => {
  const message = error.message
  if (recordId) {
    await service.updateIntcomexOrders({ id: recordId, state: "failed", error: message })
    return { ok: false, recordId, error: message }
  }
  const created = await service.createIntcomexOrders({
    medusa_order_id: medusaOrderId,
    customer_order_number: number,
    state: "failed",
    error: message,
  })
  return { ok: false, recordId: created.id, error: message }
}

// Registra el pedido en el ledger con su snapshot de costos para calcular la utilidad de los socios.
// Es idempotente: un reintento no duplica el registro.
const recordInLedgerStep = createStep(
  "record-in-ledger",
  async ({ order, result }: { order: OrderForIntcomex; result: PlaceResult }, { container }) => {
    if (!result.ok || !result.recordId) {
      return new StepResponse({ recorded: false })
    }
    const intcomex: IntcomexModuleService = container.resolve(INTCOMEX_MODULE)
    const ledger: LedgerModuleService = container.resolve(LEDGER_MODULE)
    const [record] = await intcomex.listIntcomexOrders({ id: result.recordId })
    const lines = (record?.price_snapshots ?? []) as unknown as LineSnapshot[]
    await recordPlacedOrder(ledger, {
      orderId: order.id,
      displayId: customerOrderNumber(order),
      lines,
      totalPaid: Number(order.total ?? 0),
      actualFee: actualGatewayFee(order),
      ivaPercent: loadPricingConfig().ivaPercent,
    })
    return new StepResponse({ recorded: true })
  },
)

export const placeIntcomexOrderWorkflow = createWorkflow(
  "place-intcomex-order",
  (input: PlaceInput) => {
    const order = loadOrderForIntcomexStep(input)
    const result = placeOrderInIntcomexStep(order)
    const ledgerInput = transform({ order, result }, (data) => data)
    recordInLedgerStep(ledgerInput)
    return new WorkflowResponse(result)
  },
)
