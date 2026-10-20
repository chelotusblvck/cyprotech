import { MedusaError } from "@medusajs/framework/utils"

import type { FlowConfig } from "./config"
import { withSignature } from "./signature"
import type {
  FlowApi,
  FlowCreateInput,
  FlowCreateResponse,
  FlowPaymentStatus,
  FlowRefundInput,
  FlowRefundStatus,
} from "./types"

export class FlowError extends MedusaError {
  flowCode?: number

  constructor(message: string, flowCode?: number) {
    super(MedusaError.Types.UNEXPECTED_STATE, message)
    this.name = "FlowError"
    this.flowCode = flowCode
  }
}

type FetchLike = typeof fetch
type Params = Record<string, string | number | boolean | undefined | null>

// Cliente de la API de Flow. Los POST envían application/x-www-form-urlencoded; los GET llevan
// los parámetros en la URL. Todos van firmados en el parámetro "s".
export class FlowClient implements FlowApi {
  readonly isMock = false

  constructor(
    private readonly config: FlowConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private clean(params: Params) {
    return Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null),
    ) as Record<string, string | number | boolean>
  }

  private async request<T>(method: "GET" | "POST", path: string, params: Params): Promise<T> {
    const signed = withSignature(this.clean({ apiKey: this.config.apiKey, ...params }), this.config.secretKey)
    const search = new URLSearchParams(Object.entries(signed).map(([key, value]) => [key, String(value)]))

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs)
    try {
      const url = `${this.config.baseUrl}${path}`
      const response =
        method === "GET"
          ? await this.fetchImpl(`${url}?${search}`, { signal: controller.signal })
          : await this.fetchImpl(url, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: search.toString(),
              signal: controller.signal,
            })

      const body = (await response.json().catch(() => null)) as
        | (T & { code?: number; message?: string })
        | null
      if (!response.ok) {
        throw new FlowError(body?.message ?? `Flow respondió ${response.status}`, body?.code ?? response.status)
      }
      return body as T
    } finally {
      clearTimeout(timer)
    }
  }

  createPayment(input: FlowCreateInput) {
    return this.request<FlowCreateResponse>("POST", "/payment/create", {
      commerceOrder: input.commerceOrder,
      subject: input.subject,
      currency: input.currency,
      amount: input.amount,
      email: input.email,
      paymentMethod: input.paymentMethod,
      urlConfirmation: input.urlConfirmation,
      urlReturn: input.urlReturn,
      timeout: input.timeout,
      optional: input.optional ? JSON.stringify(input.optional) : undefined,
    })
  }

  getPaymentStatus(token: string) {
    return this.request<FlowPaymentStatus>("GET", "/payment/getStatus", { token })
  }

  createRefund(input: FlowRefundInput) {
    return this.request<FlowRefundStatus>("POST", "/refund/create", {
      refundCommerceOrder: input.refundCommerceOrder,
      receiverEmail: input.receiverEmail,
      amount: input.amount,
      urlCallBack: input.urlCallBack,
      commerceTrxId: input.commerceTrxId,
      flowTrxId: input.flowTrxId,
    })
  }
}
