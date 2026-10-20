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
  // idempotencyKey: la misma clave nunca emite dos veces (OpenFactura la recuerda 24 horas).
  emit(request: EmissionRequest, idempotencyKey: string): Promise<EmissionResult>
  getStatus(token: string): Promise<SiiStatus>
  // PDF del documento (OpenFactura lo genera al pedirlo si no se solicitó al emitir).
  getPdf(token: string): Promise<Buffer>
}
