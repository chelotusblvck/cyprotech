import { randomBytes } from "crypto"

import { MedusaError } from "@medusajs/framework/utils"

import type { EmissionRequest } from "../dte"
import { DTE_LABEL } from "../types"
import { buildSimplePdf } from "./simple-pdf"
import type { EmissionResult, OpenFacturaApi, SiiStatus } from "./types"

type Stored = { folio: number; request: EmissionRequest; key: string }

// Estado compartido (vive en el mismo proceso que el servidor).
const documents = new Map<string, Stored>()
const byKey = new Map<string, string>()
const folios: Record<number, number> = {}

type Dte = {
  Encabezado: {
    IdDoc: { TipoDTE: number; FchEmis: string }
    Receptor: { RUTRecep: string; RznSocRecep?: string }
    Totales: { MntTotal: number }
  }
  Detalle: { NmbItem: string; QtyItem: number; MontoItem: number }[]
}

const money = (value: number) => `$${Math.round(value).toLocaleString("es-CL")}`

// Emisor simulado: da folios correlativos, respeta la idempotencia y genera un PDF de prueba.
export class MockOpenFacturaClient implements OpenFacturaApi {
  readonly isMock = true

  async emit(request: EmissionRequest, idempotencyKey: string): Promise<EmissionResult> {
    const existing = byKey.get(idempotencyKey)
    if (existing) {
      return { token: existing, folio: documents.get(existing)!.folio, resolucion: null }
    }
    const type = (request.dte as unknown as Dte).Encabezado.IdDoc.TipoDTE
    folios[type] = (folios[type] ?? 100) + 1
    const token = randomBytes(32).toString("hex")
    documents.set(token, { folio: folios[type], request, key: idempotencyKey })
    byKey.set(idempotencyKey, token)
    return { token, folio: folios[type], resolucion: { fecha: "2018-03-26", numero: 0 } }
  }

  async getStatus(token: string): Promise<SiiStatus> {
    return documents.has(token) ? "Aceptado" : "Rechazado"
  }

  async getPdf(token: string): Promise<Buffer> {
    const stored = documents.get(token)
    if (!stored) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `Documento simulado ${token} no existe`)
    }
    const dte = stored.request.dte as unknown as Dte
    const { IdDoc, Receptor, Totales } = dte.Encabezado
    return buildSimplePdf([
      `${DTE_LABEL[IdDoc.TipoDTE] ?? "Documento"} N° ${stored.folio}`,
      "DOCUMENTO DE PRUEBA SIN VALIDEZ TRIBUTARIA",
      "",
      `Fecha: ${IdDoc.FchEmis}`,
      `Receptor: ${Receptor.RznSocRecep ?? "Consumidor final"} (${Receptor.RUTRecep})`,
      "",
      ...dte.Detalle.map((line) => `${line.QtyItem} x ${line.NmbItem}  ${money(line.MontoItem)}`),
      "",
      `TOTAL ${money(Totales.MntTotal)} (IVA incluido)`,
    ])
  }
}
