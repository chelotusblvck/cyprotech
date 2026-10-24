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
import { AbstractPaymentProvider } from "@medusajs/framework/utils"

type Options = Record<string, unknown>

// Transferencia bancaria directa. El pedido se crea de inmediato con el pago AUTORIZADO pero sin capturar;
// el pago se da por recibido cuando alguien lo captura en el admin (pedido > "Capturar pago") al ver el
// deposito. Mientras no se capture no se emite boleta/factura ni se coloca el pedido en Intcomex
// (ver lib/transfer/state.ts). Los reembolsos se hacen a mano por transferencia.
class TransferPaymentProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "transfer"

  constructor(container: Record<string, unknown>, options: Options) {
    super(container, options)
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    return { id: `transfer_${input.context?.idempotency_key ?? Date.now()}`, status: "pending", data: {} }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { status: "pending", data: input.data ?? {} }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    return { status: "authorized", data: input.data ?? {} }
  }

  // La captura es la confirmacion manual de que llego el dinero.
  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return { data: input.data }
  }

  async getPaymentStatus(_input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    return { status: "authorized" }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return { data: input.data ?? {} }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    return { data: input.data }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: input.data }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data }
  }

  async getWebhookActionAndData(_payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    return { action: "not_supported" }
  }
}

export default TransferPaymentProviderService
