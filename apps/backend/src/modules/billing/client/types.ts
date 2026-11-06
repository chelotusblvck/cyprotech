import type { EmissionRequest } from "../dte"

export type EmissionResult = {
  token: string
  folio: number
  // Fecha y número de resolución del SII del tipo de documento (útil para la representación impresa).
  resolucion?: { fecha: string; numero: number } | null
}

// Estado del documento ante el SII.
export type SiiStatus = "Aceptado" | "Pendiente" | "Rechazado" | "Aceptado con Reparo"

export interface OpenFacturaApi {
  readonly isMock: boolean
  // Verdadero si los datos tributarios del emisor y los folios viven en el proveedor (el servicio de boletas de Garage360)
  // y no en las variables BILLING_EMISOR_* de esta tienda.
  readonly issuerManagedRemotely?: boolean
  // "manual": el proveedor no emite notas de crédito por API. La anulación se registra (requestCancellation) y la nota se
  // emite a mano en el portal del SII; después se confirma con su folio (confirmCancellation).
  readonly cancellation?: "manual"
  requestCancellation?(folio: number, reason: string): Promise<{ instructions: string }>
  confirmCancellation?(folio: number, creditNoteFolio: number, date?: string): Promise<void>
  // idempotencyKey: la misma clave nunca emite dos veces (OpenFactura la recuerda 24 horas).
  emit(request: EmissionRequest, idempotencyKey: string): Promise<EmissionResult>
  getStatus(token: string): Promise<SiiStatus>
  // PDF del documento (OpenFactura lo genera al pedirlo si no se solicitó al emitir).
  getPdf(token: string): Promise<Buffer>
}
