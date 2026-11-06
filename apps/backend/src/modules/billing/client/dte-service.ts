import type { EmissionRequest } from "../dte"
import { OpenFacturaError } from "./client"
import type { EmissionResult, OpenFacturaApi, SiiStatus } from "./types"

// Cliente del servicio de boletas de Garage360 (repositorio garage360-dte): emite las boletas contra el SII con
// folios, timbre y firma propios. Implementa la misma interfaz que OpenFactura, así el flujo de pedidos no cambia: lo
// único que se cambia es la variable de entorno. Contrato completo en docs/integracion.md de ese repositorio.
//
// El servicio solo emite boletas (39). Las facturas fallan sin reintento para que una persona las emita; las notas de
// crédito no se emiten por API: la anulación se registra en el servicio y la nota se emite a mano en el portal del SII
// (ver requestCancellation).

export type DteServiceConfig = {
  baseUrl: string
  token: string
  timeoutMs: number
}

// Devuelve null mientras no estén la dirección y el token del servicio.
export const loadDteServiceConfig = (env: NodeJS.ProcessEnv = process.env): DteServiceConfig | null => {
  const baseUrl = env.DTE_SERVICE_URL?.trim()
  const token = env.DTE_SERVICE_TOKEN?.trim()
  if (!baseUrl || !token) {
    return null
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), token, timeoutMs: Number(env.DTE_SERVICE_TIMEOUT_MS) || 30_000 }
}

type FetchLike = typeof fetch
type ErrorBody = { error?: { codigo?: string; mensaje?: string } }

const RUT_CONSUMIDOR_FINAL = "66666666-6"
const MAX_NAME = 80

type Detail = { NmbItem: string; QtyItem: number; PrcItem: number }
type EmissionDte = {
  Encabezado?: { IdDoc?: { TipoDTE?: number }; Receptor?: { RUTRecep?: string; RznSocRecep?: string }; Totales?: { MntTotal?: number } }
  Detalle?: Detail[]
}

// El servicio solo acepta ISO-8859-1: lo que no cabe (emojis, €) se reemplaza en vez de rechazar la venta.
const latin1 = (text: string) =>
  [...text]
    .map((char) => (char.codePointAt(0)! > 0xff ? "?" : char))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME)

// El token del documento es "folio-codigo"; las consultas al servicio van por folio.
const folioDe = (token: string): number => {
  const match = /^(\d+)-[0-9a-f]{16}$/.exec(token)
  if (!match) {
    throw new OpenFacturaError("Token de documento inválido.", 404)
  }
  return Number(match[1])
}

export class DteServiceClient implements OpenFacturaApi {
  readonly isMock = false
  // Los datos del emisor (RUT, giro, dirección) y los folios viven en el servicio, no en esta tienda.
  readonly issuerManagedRemotely = true

  constructor(
    private readonly config: DteServiceConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private async request(path: string, init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" }): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs)
    try {
      return await this.fetchImpl(`${this.config.baseUrl}${path}`, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal,
      })
    } catch (error) {
      // Corte de red o tiempo agotado: se reintenta (la referencia hace seguro el reintento).
      throw new OpenFacturaError(`No se pudo conectar con el servicio de boletas: ${(error as Error).message}`, 503)
    } finally {
      clearTimeout(timer)
    }
  }

  private async toError(response: Response): Promise<OpenFacturaError> {
    const body = (await response.json().catch(() => ({}))) as ErrorBody
    return new OpenFacturaError(body.error?.mensaje ?? `El servicio de boletas respondió ${response.status}`, response.status, {
      code: body.error?.codigo,
    })
  }

  async emit(request: EmissionRequest, idempotencyKey: string): Promise<EmissionResult> {
    const dte = request.dte as unknown as EmissionDte
    const tipo = dte.Encabezado?.IdDoc?.TipoDTE
    if (tipo !== 39) {
      // 422: no se arregla reintentando.
      throw new OpenFacturaError(
        `El servicio de boletas solo emite boletas (39); este pedido pide el documento ${tipo}. Hay que emitirlo a mano.`,
        422,
      )
    }

    const rut = dte.Encabezado?.Receptor?.RUTRecep
    const name = dte.Encabezado?.Receptor?.RznSocRecep
    const response = await this.request("/v1/boletas", {
      method: "POST",
      body: {
        // La clave de idempotencia de la tienda (pedido + tipo) es la referencia: pedir dos veces lo mismo devuelve la
        // misma boleta sin gastar otro folio.
        referencia: idempotencyKey,
        items: (dte.Detalle ?? []).map((line) => ({
          nombre: latin1(line.NmbItem),
          cantidad: line.QtyItem,
          precioUnitario: line.PrcItem,
        })),
        ...(rut && rut !== RUT_CONSUMIDOR_FINAL ? { receptorRut: rut } : {}),
        ...(rut && rut !== RUT_CONSUMIDOR_FINAL && name ? { receptorNombre: latin1(name) } : {}),
      },
    })
    if (!response.ok) {
      throw await this.toError(response)
    }

    const body = (await response.json()) as { folio: number; total: number; codigo?: string }
    const expected = dte.Encabezado?.Totales?.MntTotal
    if (expected !== undefined && body.total !== expected) {
      // Nunca debería pasar: las líneas del pedido suman lo cobrado. Si pasa, la boleta ya existe en el servicio pero no
      // coincide con lo cobrado: se corta aquí para que una persona la revise.
      throw new OpenFacturaError(
        `La boleta ${body.folio} del servicio suma ${body.total} pero el pedido cobró ${expected}. Revisar a mano.`,
        422,
      )
    }
    if (!body.codigo) {
      throw new OpenFacturaError("El servicio de boletas no devolvió el código de consulta: hay que actualizarlo.", 422)
    }
    // El token público de descarga es "folio-codigo". El folio solo es consecutivo (cualquiera podría recorrerlos y ver las
    // boletas de todos los clientes); el código no se puede adivinar.
    return { token: `${body.folio}-${body.codigo}`, folio: body.folio, resolucion: null }
  }

  async getStatus(token: string): Promise<SiiStatus> {
    const response = await this.request(`/v1/boletas/${folioDe(token)}`)
    if (!response.ok) {
      throw await this.toError(response)
    }
    const { estado } = (await response.json()) as { estado?: string }
    if (estado === "ACEPTADO") return "Aceptado"
    if (estado === "RECHAZADO") return "Rechazado"
    // FIRMADO (aún no enviada al SII) y ENVIADO (validándose).
    return "Pendiente"
  }

  async getPdf(token: string): Promise<Buffer> {
    // El PDF es liviano, pero un corte pasajero se reintenta un par de veces.
    for (let attempt = 0; ; attempt++) {
      const response = await this.request(`/v1/boletas/${folioDe(token)}/pdf`)
      if (response.ok) {
        return Buffer.from(await response.arrayBuffer())
      }
      const error = await this.toError(response)
      if (!error.retryable || attempt >= 2) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
    }
  }

  // Una boleta electrónica se anula con una Nota de Crédito electrónica. Garage360 está inscrita solo en boletas, así que
  // la nota se emite a mano en el portal del SII. Aquí se registra la solicitud en el servicio para que no se pierda.
  readonly cancellation = "manual" as const

  async requestCancellation(folio: number, reason: string): Promise<{ instructions: string }> {
    const response = await this.request(`/v1/boletas/${folio}/anulacion`, { method: "POST", body: { motivo: reason } })
    if (!response.ok) {
      throw await this.toError(response)
    }
    const body = (await response.json()) as { instrucciones?: string }
    return { instructions: body.instrucciones ?? "" }
  }

  // Registra el folio de la Nota de Crédito ya emitida en el portal del SII. La boleta pasa a figurar como anulada.
  async confirmCancellation(folio: number, creditNoteFolio: number, date?: string): Promise<void> {
    const response = await this.request(`/v1/boletas/${folio}/anulacion/emitida`, {
      method: "POST",
      body: { folioNotaCredito: creditNoteFolio, ...(date ? { fecha: date } : {}) },
    })
    if (!response.ok) {
      throw await this.toError(response)
    }
  }
}
