import { FLOW_STATUS, type FlowPaymentStatus } from "./client/types"

// Estados de una sesión de pago de Medusa que usa este proveedor.
export type SessionStatus = "pending" | "authorized" | "captured" | "canceled" | "error"

// Datos que se guardan en la sesión de pago. La tienda lee redirectUrl para llevar al cliente a Flow.
export type FlowSessionData = {
  sessionId: string
  // commerceOrder = sessionId, o sessionId-N cuando hay que regenerar la orden de Flow
  // (por ejemplo, si cambió el monto del carrito).
  commerceOrder: string
  attempt: number
  flowToken: string
  flowOrder: number
  redirectUrl: string
  amount: number
  currency: string
  email: string
  // Se completan cuando Flow confirma el pago.
  flowStatus?: number
  paidAmount?: number | null
  // Comisión real que cobra Flow por este pago.
  flowFee?: number | null
  flowBalance?: number | null
  flowMedia?: string | null
  paidAt?: string | null
  refunds?: { token: string; flowRefundOrder: string; amount: number; status: string }[]
}

export const mapFlowStatus = (status: number): SessionStatus => {
  switch (status) {
    case FLOW_STATUS.PAID:
      // Flow cobra al instante: no hay un paso de captura posterior.
      return "captured"
    case FLOW_STATUS.REJECTED:
      return "error"
    case FLOW_STATUS.CANCELED:
      return "canceled"
    default:
      return "pending"
  }
}

export const commerceOrderFor = (sessionId: string, attempt: number) =>
  attempt === 0 ? sessionId : `${sessionId}-${attempt}`

// El id de la sesión de Medusa es lo que va antes del primer guion.
export const sessionIdFrom = (commerceOrder: string) => commerceOrder.split("-")[0]

export const toAmount = (value: unknown): number => {
  if (typeof value === "object" && value !== null && "numeric" in value) {
    return Number((value as { numeric: number }).numeric)
  }
  return Number(value)
}

// Copia al dato de la sesión lo que Flow informa sobre el pago.
export const applyFlowStatus = (data: FlowSessionData, flow: FlowPaymentStatus): FlowSessionData => ({
  ...data,
  flowStatus: flow.status,
  paidAmount: flow.paymentData?.amount ?? null,
  flowFee: flow.paymentData?.fee ?? null,
  flowBalance: flow.paymentData?.balance ?? null,
  flowMedia: flow.paymentData?.media ?? null,
  paidAt: flow.paymentData?.date ?? null,
})
