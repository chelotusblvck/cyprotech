import { MedusaError } from "@medusajs/framework/utils"

import { CONSUMIDOR_FINAL, parseRut } from "./rut"
import {
  DTE,
  type DocumentRequest,
  type DteLine,
  type DteTotals,
  type Emisor,
  type OrderForBilling,
  type Receptor,
} from "./types"

// Armado de los documentos tributarios que se envían a OpenFactura. Los nombres de campo son los
// del SII (distinguen mayúsculas). Todo es CLP entero.

const IVA = 19
const MAX_NAME = 80

const round = (value: number) => Math.round(value)
const upper = (value: string) => value.toUpperCase()

// Los textos van sin saltos de línea, sin espacios dobles y con el largo máximo del SII.
export const clean = (value: string | null | undefined, max = MAX_NAME) =>
  (value ?? "").replace(/\s+/g, " ").trim().slice(0, max)

// Fecha de emisión en hora de Chile (AAAA-MM-DD).
export const emissionDate = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)

// Lee lo que pidió el cliente en el checkout (metadata del pedido). Sin datos válidos de factura
// se emite boleta: nunca se bloquea una venta por un dato tributario mal escrito.
export const documentRequestFrom = (metadata: Record<string, unknown> | null | undefined): DocumentRequest => {
  const doc = (metadata?.document ?? null) as Record<string, unknown> | null
  const rutFromMetadata = typeof metadata?.rut === "string" ? metadata.rut : undefined

  if (doc?.type === "factura") {
    const rut = parseRut(typeof doc.rut === "string" ? doc.rut : undefined)
    const razonSocial = clean(doc.razonSocial as string, 100)
    const giro = clean(doc.giro as string, 80)
    const direccion = clean(doc.direccion as string, 70)
    const comuna = clean(doc.comuna as string, 20)
    if (rut && razonSocial && giro && direccion && comuna) {
      return { type: "factura", rut: rut.formatted, razonSocial, giro, direccion, comuna }
    }
  }
  const boletaRut = parseRut(typeof doc?.rut === "string" ? doc.rut : rutFromMetadata)
  return { type: "boleta", rut: boletaRut?.formatted }
}

// Líneas del documento a partir del pedido: cada producto, más el despacho. Los montos son los que
// pagó el cliente (con IVA y con descuentos aplicados). Si la cantidad no divide exacto el total
// de la línea (por un descuento), se emite como una sola unidad para no inventar decimales.
export const linesFromOrder = (order: OrderForBilling): DteLine[] => {
  const lines: DteLine[] = (order.items ?? []).map((item) => {
    const total = round(item.total ?? item.unit_price * item.quantity)
    const name = clean(item.product_title ?? item.title ?? "Producto", item.quantity > 1 ? 70 : MAX_NAME)
    if (total % item.quantity === 0) {
      return { name, quantity: item.quantity, unitPrice: total / item.quantity, total }
    }
    return { name: clean(`${name} x${item.quantity}`), quantity: 1, unitPrice: total, total }
  })
  const shipping = round(order.shipping_total ?? 0)
  if (shipping > 0) {
    lines.push({ name: "Despacho", quantity: 1, unitPrice: shipping, total: shipping })
  }

  // Un documento que no coincide con lo cobrado no se emite. Hasta $3 de diferencia se absorbe en
  // la última línea (redondeos de impuestos); más que eso es un dato inconsistente.
  const sum = lines.reduce((acc, line) => acc + line.total, 0)
  const diff = round(order.total) - sum
  if (Math.abs(diff) > 3) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Las líneas del pedido (${sum}) no calzan con el total cobrado (${round(order.total)}).`,
    )
  }
  if (diff !== 0 && lines.length > 0) {
    const last = lines[lines.length - 1]
    last.total += diff
    if (last.total % last.quantity === 0) {
      last.unitPrice = last.total / last.quantity
    } else {
      last.name = clean(`${last.name} x${last.quantity}`)
      last.quantity = 1
      last.unitPrice = last.total
    }
  }
  return lines
}

// Neto e IVA a partir del total con IVA incluido. El neto se redondea y el IVA es la diferencia,
// así la suma siempre calza con lo cobrado.
export const totalsFromGross = (gross: number): DteTotals => {
  const neto = round(gross / (1 + IVA / 100))
  return { neto, iva: gross - neto, total: gross }
}

// Para facturas las líneas van en neto: cada una se convierte y la última absorbe el redondeo.
export const netLines = (lines: DteLine[], neto: number): DteLine[] => {
  const converted = lines.map((line) => {
    const lineNet = round(line.total / (1 + IVA / 100))
    return { ...line, total: lineNet, unitPrice: line.quantity > 0 ? lineNet / line.quantity : lineNet }
  })
  const diff = neto - converted.reduce((acc, line) => acc + line.total, 0)
  if (diff !== 0 && converted.length > 0) {
    const last = converted[converted.length - 1]
    last.total += diff
    last.unitPrice = last.total / last.quantity
  }
  return converted
}

const detail = (lines: DteLine[]) =>
  lines.map((line, index) => ({
    NroLinDet: index + 1,
    NmbItem: clean(line.name),
    QtyItem: line.quantity,
    PrcItem: line.unitPrice,
    MontoItem: line.total,
  }))

export type EmissionRequest = {
  response: string[]
  dte: Record<string, unknown>
}

const RESPONSE = ["FOLIO", "RESOLUCION"]

const emisorBoleta = (emisor: Emisor) => ({
  RUTEmisor: emisor.rut,
  RznSocEmisor: upper(clean(emisor.razonSocial, 100)),
  GiroEmisor: upper(clean(emisor.giro, 80)),
  ...(emisor.codigoSucursal ? { CdgSIISucur: emisor.codigoSucursal } : {}),
  DirOrigen: upper(clean(emisor.direccion, 70)),
  CmnaOrigen: clean(emisor.comuna, 20),
})

const emisorFactura = (emisor: Emisor) => ({
  RUTEmisor: emisor.rut,
  RznSoc: upper(clean(emisor.razonSocial, 100)),
  GiroEmis: upper(clean(emisor.giro, 80)),
  Acteco: emisor.acteco,
  ...(emisor.codigoSucursal ? { CdgSIISucur: emisor.codigoSucursal } : {}),
  DirOrigen: upper(clean(emisor.direccion, 70)),
  CmnaOrigen: clean(emisor.comuna, 20),
})

export const buildBoleta = (input: {
  lines: DteLine[]
  total: number
  emisor: Emisor
  receptorRut?: string
  receptorName?: string
  date: Date
}): EmissionRequest => {
  const totals = totalsFromGross(input.total)
  return {
    response: RESPONSE,
    dte: {
      Encabezado: {
        IdDoc: { TipoDTE: DTE.BOLETA, Folio: 0, FchEmis: emissionDate(input.date), IndServicio: "3" },
        Emisor: emisorBoleta(input.emisor),
        Receptor: {
          RUTRecep: input.receptorRut ?? CONSUMIDOR_FINAL,
          ...(input.receptorRut && input.receptorName ? { RznSocRecep: upper(clean(input.receptorName, 100)) } : {}),
        },
        Totales: {
          MntNeto: totals.neto,
          IVA: totals.iva,
          MntTotal: totals.total,
          TotalPeriodo: totals.total,
          VlrPagar: totals.total,
        },
      },
      Detalle: detail(input.lines),
    },
  }
}

export const buildFactura = (input: {
  lines: DteLine[]
  total: number
  emisor: Emisor
  receptor: Required<Pick<Receptor, "rut" | "razonSocial" | "giro" | "direccion" | "comuna">>
  date: Date
}): EmissionRequest => {
  const totals = totalsFromGross(input.total)
  return {
    response: RESPONSE,
    dte: {
      Encabezado: {
        IdDoc: {
          TipoDTE: DTE.FACTURA,
          Folio: 0,
          FchEmis: emissionDate(input.date),
          TpoTranCompra: "1",
          TpoTranVenta: "1",
          // 1 = contado: el cliente ya pagó en la tienda.
          FmaPago: "1",
        },
        Emisor: emisorFactura(input.emisor),
        Receptor: {
          RUTRecep: input.receptor.rut,
          RznSocRecep: upper(clean(input.receptor.razonSocial, 100)),
          GiroRecep: upper(clean(input.receptor.giro, 40)),
          DirRecep: upper(clean(input.receptor.direccion, 70)),
          CmnaRecep: clean(input.receptor.comuna, 20),
        },
        Totales: {
          MntNeto: totals.neto,
          TasaIVA: String(IVA),
          IVA: totals.iva,
          MntTotal: totals.total,
          MontoPeriodo: totals.total,
          VlrPagar: totals.total,
        },
      },
      Detalle: detail(netLines(input.lines, totals.neto)),
    },
  }
}

// Nota de crédito que anula un documento ya emitido (devolución o cancelación). Replica sus líneas
// (siempre las del pedido, con IVA) y montos y lo referencia por tipo, folio y fecha. CodRef 1 = anula el documento.
export const buildCreditNote = (input: {
  original: { type: number; folio: number; date: string; lines: DteLine[]; total: number }
  emisor: Emisor
  receptor?: Receptor | null
  reason: string
  date: Date
}): EmissionRequest => {
  const totals = totalsFromGross(input.original.total)
  const receptor = input.receptor
  return {
    response: RESPONSE,
    dte: {
      Encabezado: {
        IdDoc: { TipoDTE: DTE.NOTA_CREDITO, Folio: 0, FchEmis: emissionDate(input.date), TpoTranVenta: "1", FmaPago: "1" },
        Emisor: emisorFactura(input.emisor),
        Receptor: {
          RUTRecep: receptor?.rut ?? CONSUMIDOR_FINAL,
          RznSocRecep: upper(clean(receptor?.razonSocial ?? "Consumidor final", 100)),
          GiroRecep: upper(clean(receptor?.giro ?? "Particular", 40)),
          DirRecep: upper(clean(receptor?.direccion ?? "Sin dirección", 70)),
          CmnaRecep: clean(receptor?.comuna ?? "Santiago", 20),
        },
        Totales: {
          MntNeto: totals.neto,
          TasaIVA: String(IVA),
          IVA: totals.iva,
          MntTotal: totals.total,
          MontoPeriodo: totals.total,
          VlrPagar: totals.total,
        },
      },
      Detalle: detail(netLines(input.original.lines, totals.neto)),
      Referencia: [
        {
          NroLinRef: 1,
          TpoDocRef: String(input.original.type),
          FolioRef: String(input.original.folio),
          FchRef: input.original.date,
          CodRef: 1,
          RazonRef: clean(input.reason, 90),
        },
      ],
    },
  }
}

// Datos del receptor para el correo y el registro, según lo que se pidió.
export const receptorFrom = (request: DocumentRequest, fallbackName?: string): Receptor | null =>
  request.type === "factura"
    ? {
        rut: request.rut,
        razonSocial: request.razonSocial,
        giro: request.giro,
        direccion: request.direccion,
        comuna: request.comuna,
      }
    : request.rut
      ? { rut: request.rut, razonSocial: fallbackName }
      : null
