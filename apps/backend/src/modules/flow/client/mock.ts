import { randomBytes } from "crypto"

import { MedusaError } from "@medusajs/framework/utils"

import { loadFlowUrls } from "./config"
import {
  FLOW_STATUS,
  type FlowApi,
  type FlowCreateInput,
  type FlowCreateResponse,
  type FlowPaymentStatus,
  type FlowRefundInput,
  type FlowRefundStatus,
} from "./types"

type MockOrder = {
  input: FlowCreateInput
  flowOrder: number
  status: number
  paidAt?: string
}

// Estado compartido entre el proveedor, las rutas y el simulador (viven en el mismo proceso).
const orders = new Map<string, MockOrder>()
let sequence = 1000

// Flow simulado para desarrollo sin credenciales. Calcula una comisión de 2,89% como Flow en el
// abono al tercer día hábil, para ejercitar el flujo que lee la comisión real.
export class MockFlowClient implements FlowApi {
  readonly isMock = true

  async createPayment(input: FlowCreateInput): Promise<FlowCreateResponse> {
    const token = randomBytes(20).toString("hex").toUpperCase()
    const flowOrder = ++sequence
    orders.set(token, { input, flowOrder, status: FLOW_STATUS.PENDING })
    // La página de pago simulada vive en la tienda (src/app/api/flow/sandbox).
    return { url: `${loadFlowUrls().storefrontUrl}/api/flow/sandbox`, token, flowOrder }
  }

  async getPaymentStatus(token: string): Promise<FlowPaymentStatus> {
    const order = orders.get(token)
    if (!order) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Orden simulada de Flow no encontrada para el token ${token}`,
      )
    }
    const paid = order.status === FLOW_STATUS.PAID
    const fee = Math.round(order.input.amount * 0.0289)
    return {
      flowOrder: order.flowOrder,
      commerceOrder: order.input.commerceOrder,
      status: order.status,
      subject: order.input.subject,
      currency: order.input.currency,
      amount: order.input.amount,
      payer: order.input.email,
      paymentData: paid
        ? {
            date: order.paidAt,
            media: "Simulado",
            amount: order.input.amount,
            currency: order.input.currency,
            fee,
            balance: order.input.amount - fee,
          }
        : { date: null, media: null, amount: null, fee: null, balance: null },
    }
  }

  async createRefund(input: FlowRefundInput): Promise<FlowRefundStatus> {
    return {
      token: randomBytes(10).toString("hex").toUpperCase(),
      flowRefundOrder: String(++sequence),
      status: "created",
      amount: input.amount,
    }
  }
}

// Solo para el simulador: fija el resultado del pago como lo haría el cliente en Flow.
export const simulateFlowResult = (token: string, result: "paid" | "rejected" | "canceled") => {
  const order = orders.get(token)
  if (!order) {
    return false
  }
  order.status =
    result === "paid" ? FLOW_STATUS.PAID : result === "rejected" ? FLOW_STATUS.REJECTED : FLOW_STATUS.CANCELED
  order.paidAt = result === "paid" ? new Date().toISOString().replace("T", " ").slice(0, 19) : undefined
  return order.input
}
