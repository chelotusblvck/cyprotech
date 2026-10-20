import { randomUUID } from "crypto"

import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import { AbstractPaymentProvider, MedusaError } from "@medusajs/framework/utils"

import { createFlowApi, loadFlowConfig, loadFlowUrls, type FlowApi } from "./client"
import {
  applyFlowStatus,
  commerceOrderFor,
  mapFlowStatus,
  toAmount,
  type FlowSessionData,
} from "./payment-data"

type Options = Record<string, unknown>

const readData = (data: Record<string, unknown> | undefined): FlowSessionData => {
  if (!data?.flowToken) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "La sesión de pago no tiene una orden de Flow.")
  }
  return data as unknown as FlowSessionData
}

// Proveedor de pagos de Flow (tarjetas de crédito y débito, transferencia y otros medios de Chile).
// Flow es un pago con redirección: la orden se crea al iniciar la sesión, el cliente paga en Flow
// y vuelve a la tienda. El pago queda confirmado por el aviso de Flow a /hooks/flow/confirm o por
// la consulta de estado al volver; en ambos casos se verifica con la API de Flow, no con lo que
// llega por el navegador.
class FlowPaymentProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "flow"

  protected api: FlowApi

  constructor(container: Record<string, unknown>, options: Options) {
    super(container, options)
    this.api = createFlowApi()
  }

  private async createFlowOrder(params: {
    sessionId: string
    attempt: number
    amount: number
    currency: string
    email: string
  }): Promise<FlowSessionData> {
    const config = loadFlowConfig()
    const urls = loadFlowUrls()
    const commerceOrder = commerceOrderFor(params.sessionId, params.attempt)

    const created = await this.api.createPayment({
      commerceOrder,
      subject: "Pedido Cyprotech",
      currency: params.currency.toUpperCase(),
      amount: params.amount,
      email: params.email,
      paymentMethod: config?.paymentMethod ?? 9,
      timeout: config?.orderTimeoutSeconds ?? 7200,
      urlConfirmation: `${urls.backendUrl}/hooks/flow/confirm`,
      urlReturn: `${urls.storefrontUrl}/api/flow/return`,
      optional: { session: params.sessionId },
    })

    return {
      sessionId: params.sessionId,
      commerceOrder,
      attempt: params.attempt,
      flowToken: created.token,
      flowOrder: created.flowOrder,
      redirectUrl: `${created.url}?token=${created.token}`,
      amount: params.amount,
      currency: params.currency.toUpperCase(),
      email: params.email,
    }
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const amount = toAmount(input.amount)
    const email = (input.data?.email as string | undefined) ?? input.context?.customer?.email
    if (!email) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Falta el correo del pagador para crear el pago en Flow.")
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `Monto inválido para Flow: ${input.amount}`)
    }
    // Medusa entrega el id de la sesión como idempotency_key.
    const sessionId = input.context?.idempotency_key ?? `local_${randomUUID()}`

    const data = await this.createFlowOrder({
      sessionId,
      attempt: 0,
      amount,
      currency: input.currency_code,
      email,
    })
    return { id: data.flowToken, status: "pending", data: data as unknown as Record<string, unknown> }
  }

  // Si el carrito cambia de monto, la orden de Flow vigente ya no sirve: se crea una nueva.
  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const current = readData(input.data)
    const amount = toAmount(input.amount)
    const email = (input.data?.email as string | undefined) ?? current.email

    if (amount === current.amount && input.currency_code.toUpperCase() === current.currency && email === current.email) {
      return { status: "pending", data: current as unknown as Record<string, unknown> }
    }
    const data = await this.createFlowOrder({
      sessionId: current.sessionId,
      attempt: current.attempt + 1,
      amount,
      currency: input.currency_code,
      email,
    })
    return { status: "pending", data: data as unknown as Record<string, unknown> }
  }

  // Consulta a Flow antes de autorizar: solo un pago confirmado y por el monto correcto pasa.
  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const current = readData(input.data)
    const flow = await this.api.getPaymentStatus(current.flowToken)
    const data = applyFlowStatus(current, flow)
    const status = mapFlowStatus(flow.status)

    if (status === "captured" && Number(flow.paymentData?.amount ?? flow.amount) !== current.amount) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `El monto pagado en Flow (${flow.paymentData?.amount}) no coincide con el del pedido (${current.amount}).`,
      )
    }
    return { status, data: data as unknown as Record<string, unknown> }
  }

  // Flow cobra al confirmar el pago, así que no hay una captura aparte.
  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return { data: input.data }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const current = readData(input.data)
    const flow = await this.api.getPaymentStatus(current.flowToken)
    return { status: mapFlowStatus(flow.status), data: applyFlowStatus(current, flow) as unknown as Record<string, unknown> }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const current = readData(input.data)
    const flow = await this.api.getPaymentStatus(current.flowToken)
    return { data: applyFlowStatus(current, flow) as unknown as Record<string, unknown> }
  }

  // El reembolso en Flow es asíncrono: se crea la solicitud y Flow avisa cuando se resuelve.
  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const current = readData(input.data)
    const amount = toAmount(input.amount)
    const urls = loadFlowUrls()
    const refunds = current.refunds ?? []

    const refund = await this.api.createRefund({
      refundCommerceOrder: `R${refunds.length + 1}-${current.commerceOrder}`,
      receiverEmail: current.email,
      amount,
      urlCallBack: `${urls.backendUrl}/hooks/flow/refund`,
      commerceTrxId: current.commerceOrder,
    })

    const data: FlowSessionData = {
      ...current,
      refunds: [
        ...refunds,
        { token: refund.token, flowRefundOrder: refund.flowRefundOrder, amount, status: refund.status },
      ],
    }
    return { data: data as unknown as Record<string, unknown> }
  }

  // Una orden de Flow sin pagar expira sola (timeout). Una ya pagada se devuelve con un reembolso.
  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: input.data }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data }
  }

  // La confirmación de Flow la recibe /hooks/flow/confirm, que verifica el pago y completa el
  // carrito con un flujo propio; el webhook genérico de Medusa no se usa.
  async getWebhookActionAndData(_payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    return { action: "not_supported" }
  }
}

export default FlowPaymentProviderService
