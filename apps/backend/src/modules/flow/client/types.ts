// Tipos de la API REST de Flow. Fuente: docs/flow/apiFlow.yaml (https://www.flow.cl/docs/api.html)

// Estado de una orden de pago en Flow.
export const FLOW_STATUS = {
  PENDING: 1,
  PAID: 2,
  REJECTED: 3,
  CANCELED: 4,
} as const

export type FlowCreateInput = {
  // Número de orden del comercio. Es único por orden de Flow.
  commerceOrder: string
  subject: string
  currency: string
  amount: number
  email: string
  urlConfirmation: string
  urlReturn: string
  // 9 = todos los medios de pago contratados.
  paymentMethod?: number
  // Segundos hasta que la orden expira si no se paga.
  timeout?: number
  optional?: Record<string, string>
}

export type FlowCreateResponse = {
  // La URL de pago es url + "?token=" + token.
  url: string
  token: string
  flowOrder: number
}

export type FlowPaymentStatus = {
  flowOrder: number
  commerceOrder: string
  requestDate?: string
  status: number
  subject?: string
  currency: string
  amount: number
  payer?: string
  optional?: Record<string, string> | null
  pending_info?: { media?: string | null; date?: string | null }
  paymentData?: {
    date?: string | null
    media?: string | null
    conversionDate?: string | null
    conversionRate?: number | null
    amount?: number | null
    currency?: string | null
    // Costo del servicio que cobra Flow por este pago.
    fee?: number | null
    // Saldo a depositar al comercio.
    balance?: number | null
    transferDate?: string | null
  }
}

export type FlowRefundInput = {
  refundCommerceOrder: string
  receiverEmail: string
  amount: number
  urlCallBack: string
  // Orden del comercio de la transacción original.
  commerceTrxId?: string
  flowTrxId?: string
}

export type FlowRefundStatus = {
  token: string
  flowRefundOrder: string
  date?: string
  // created | accepted | rejected | refunded | canceled
  status: string
  amount: number | string
  fee?: number | string
}

// Superficie que usa el resto del sistema. La implementan el cliente real y el simulado.
export interface FlowApi {
  readonly isMock: boolean
  createPayment(input: FlowCreateInput): Promise<FlowCreateResponse>
  getPaymentStatus(token: string): Promise<FlowPaymentStatus>
  createRefund(input: FlowRefundInput): Promise<FlowRefundStatus>
}
