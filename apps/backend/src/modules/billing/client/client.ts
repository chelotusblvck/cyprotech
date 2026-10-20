import { MedusaError } from "@medusajs/framework/utils"

import type { EmissionRequest } from "../dte"
import type { OpenFacturaConfig } from "./config"
import type { EmissionResult, OpenFacturaApi, SiiStatus } from "./types"

export class OpenFacturaError extends MedusaError {
  status: number
  code?: string
  details?: { field?: string; issue?: string }[]
  // Cuando la emisión ya existía (OF-06), OpenFactura entrega el token del documento original.
  token?: string

  constructor(message: string, status: number, extra: Partial<OpenFacturaError> = {}) {
    super(MedusaError.Types.UNEXPECTED_STATE, message)
    this.name = "OpenFacturaError"
    this.status = status
    this.code = extra.code
    this.details = extra.details
    this.token = extra.token
  }

  // Los errores de validación (OF-10 y similares) no se arreglan reintentando; los de red o de
  // servicio sí. El límite de peticiones (429) se reintenta más tarde.
  get retryable() {
    return this.status === 429 || this.status >= 500
  }
}

type FetchLike = typeof fetch
type ErrorBody = {
  error?: { message?: string; code?: string; token?: string; details?: { field?: string; issue?: string }[] }
  message?: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class OpenFacturaClient implements OpenFacturaApi {
  readonly isMock = false

  constructor(
    private readonly config: OpenFacturaConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private async request(path: string, init: { method: "GET" | "POST"; body?: unknown; idempotencyKey?: string }) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs)
    try {
      return await this.fetchImpl(`${this.config.baseUrl}${path}`, {
        method: init.method,
        headers: {
          apikey: this.config.apiKey,
          "Content-Type": "application/json",
          ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  }

  private async toError(response: Response) {
    const body = (await response.json().catch(() => ({}))) as ErrorBody
    const detail = body.error?.details?.map((d) => `${d.field}: ${d.issue}`).join("; ")
    return new OpenFacturaError(
      [body.error?.message ?? body.message ?? `OpenFactura respondió ${response.status}`, detail].filter(Boolean).join(" - "),
      response.status,
      {
        code: body.error?.code,
        details: body.error?.details,
        // En la práctica el token del documento original llega en details ({ field: "token" }).
        token: body.error?.token ?? body.error?.details?.find((d) => d.field === "token")?.issue,
      },
    )
  }

  async emit(request: EmissionRequest, idempotencyKey: string): Promise<EmissionResult> {
    const response = await this.request("/v2/dte/document", { method: "POST", body: request, idempotencyKey })

    if (response.ok) {
      const body = (await response.json()) as { TOKEN: string; FOLIO: number; RESOLUCION?: EmissionResult["resolucion"] }
      return { token: body.TOKEN, folio: body.FOLIO, resolucion: body.RESOLUCION ?? null }
    }

    const error = await this.toError(response)
    // OF-06: ya se emitió con esta clave. Es un reintento seguro: se recupera el folio del original.
    if (error.token && (error.code === "OF-06" || /idempotency/i.test(error.message))) {
      const folio = await this.getFolio(error.token)
      return { token: error.token, folio, resolucion: null }
    }
    throw error
  }

  private async getFolio(token: string) {
    const response = await this.request(`/v2/dte/document/${token}/json`, { method: "GET" })
    if (!response.ok) {
      throw await this.toError(response)
    }
    const body = (await response.json()) as { json?: string | { Encabezado?: { IdDoc?: { Folio?: number } } } }
    const parsed = typeof body.json === "string" ? JSON.parse(body.json) : body.json
    const folio = Number(parsed?.Encabezado?.IdDoc?.Folio ?? parsed?.dte?.Encabezado?.IdDoc?.Folio)
    return Number.isFinite(folio) ? folio : 0
  }

  async getStatus(token: string): Promise<SiiStatus> {
    const response = await this.request(`/v2/dte/document/${token}/status`, { method: "GET" })
    if (!response.ok) {
      throw await this.toError(response)
    }
    // OpenFactura responde { estado, token }; la documentación dice "status" pero el campo real es "estado".
    const body = (await response.json()) as { estado?: SiiStatus; status?: SiiStatus }
    return (body.estado ?? body.status ?? "Pendiente") as SiiStatus
  }

  async getPdf(token: string): Promise<Buffer> {
    // La generación del PDF puede tardar; 429 y 5xx se reintentan unas veces.
    for (let attempt = 0; ; attempt++) {
      const response = await this.request(`/v2/dte/document/${token}/pdf`, { method: "GET" })
      if (response.ok) {
        const body = (await response.json()) as { pdf: string }
        return Buffer.from(body.pdf, "base64")
      }
      const error = await this.toError(response)
      if (!error.retryable || attempt >= 2) {
        throw error
      }
      await sleep(1000 * (attempt + 1))
    }
  }
}
