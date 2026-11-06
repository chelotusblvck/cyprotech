import { OpenFacturaError } from "./client/client"
import type { OpenFacturaApi } from "./client/types"
import { buildBoleta, buildCreditNote, buildFactura, documentRequestFrom, emissionDate, linesFromOrder, receptorFrom } from "./dte"
import type BillingModuleService from "./service"
import { DTE, type DteLine, type Emisor, type OrderForBilling, type Receptor } from "./types"

type Service = Pick<BillingModuleService, "listBillingDocuments" | "createBillingDocuments" | "updateBillingDocuments">

export type BillingDeps = {
  service: Service
  api: OpenFacturaApi
  // Datos tributarios del vendedor. Null si no están configurados.
  emisor: Emisor | null
  now?: Date
  // Se llaman después de guardar el resultado. No deben lanzar: si el aviso falla, el documento ya existe.
  onIssued?: (documentId: string) => Promise<void>
  onFailed?: (documentId: string, error: string, retryable: boolean) => Promise<void>
  // Proveedores sin notas de crédito por API: avisa que hay una nota por emitir a mano en el portal del SII.
  onManualCreditNote?: (documentId: string, instructions: string) => Promise<void>
}

export type IssueResult = {
  ok: boolean
  documentId?: string
  folio?: number | null
  alreadyIssued?: boolean
  // Anulación pendiente de que una persona emita la nota de crédito en el portal del SII.
  manual?: boolean
  instructions?: string
  error?: string
}

// OpenFactura recuerda una clave de idempotencia por 24 horas. Dentro de esa ventana reintentar es
// seguro (nunca emite dos veces); pasada la ventana un reintento podría duplicar el documento, así que
// se corta antes y se pide revisión manual.
export const SAFE_RETRY_WINDOW_MS = 20 * 3_600_000
export const MAX_ATTEMPTS = 8

type Row = Awaited<ReturnType<Service["listBillingDocuments"]>>[number]

const idempotencyKey = (orderId: string, kind: string) => `${orderId}-${kind}`

const failure = async (
  deps: BillingDeps,
  row: Row,
  error: unknown,
  retryable: boolean,
): Promise<IssueResult> => {
  const message = (error as Error).message ?? String(error)
  await deps.service.updateBillingDocuments({ id: row.id, state: "failed", last_error: message, retryable })
  await deps.onFailed?.(row.id, message, retryable).catch(() => undefined)
  return { ok: false, documentId: row.id, error: message }
}

// Emite la boleta (o la factura, si el cliente la pidió) de un pedido. Es idempotente: si ya está
// emitida la devuelve, y un reintento tras un corte de red no genera un segundo documento.
export const issueDocument = async (
  deps: BillingDeps,
  order: OrderForBilling,
  options: { force?: boolean } = {},
): Promise<IssueResult> => {
  const now = deps.now ?? new Date()
  const request = documentRequestFrom(order.metadata)
  const kind = request.type

  const existing = (await deps.service.listBillingDocuments({ medusa_order_id: order.id })).find(
    (doc) => doc.kind !== "nota_credito",
  )
  if (existing?.state === "issued") {
    return { ok: true, alreadyIssued: true, documentId: existing.id, folio: existing.folio }
  }

  const customerName = [order.shipping_address?.first_name, order.shipping_address?.last_name].filter(Boolean).join(" ")
  const receptor = receptorFrom(request, customerName)
  const tipoDte = kind === "factura" ? DTE.FACTURA : DTE.BOLETA

  const base = {
    medusa_order_id: order.id,
    kind,
    tipo_dte: tipoDte,
    total: order.total,
    receptor: receptor as unknown as Record<string, unknown> | null,
  }
  const row =
    existing ??
    (await deps.service.createBillingDocuments({
      ...base,
      state: "pending",
      attempts: 0,
      first_attempt_at: now,
    }))

  if (
    existing &&
    !options.force &&
    !existing.token &&
    existing.first_attempt_at &&
    now.getTime() - new Date(existing.first_attempt_at).getTime() > SAFE_RETRY_WINDOW_MS
  ) {
    return failure(
      deps,
      row,
      new Error(
        "Pasó el plazo seguro de reintento (20 horas). Revisa en OpenFactura si el documento ya se emitió antes de volver a intentarlo.",
      ),
      false,
    )
  }

  await deps.service.updateBillingDocuments({
    id: row.id,
    ...base,
    state: "pending",
    attempts: (row.attempts ?? 0) + 1,
    last_attempt_at: now,
  })

  if (!deps.emisor) {
    return failure(deps, row, new Error("Faltan los datos tributarios del emisor (variables BILLING_EMISOR_*)."), false)
  }

  let lines: DteLine[]
  let emission
  try {
    lines = linesFromOrder(order)
    emission =
      request.type === "factura"
        ? buildFactura({ lines, total: order.total, emisor: deps.emisor, receptor: request, date: now })
        : buildBoleta({
            lines,
            total: order.total,
            emisor: deps.emisor,
            receptorRut: request.rut,
            receptorName: customerName || undefined,
            date: now,
          })
  } catch (error) {
    // Un pedido inconsistente no se arregla reintentando.
    return failure(deps, row, error, false)
  }

  try {
    const result = await deps.api.emit(emission, idempotencyKey(order.id, kind))
    await deps.service.updateBillingDocuments({
      id: row.id,
      state: "issued",
      folio: result.folio,
      token: result.token,
      sii_status: "Pendiente",
      lines: lines as unknown as Record<string, unknown>,
      emission_date: emissionDate(now),
      issued_at: now,
      last_error: null,
    })
    await deps.onIssued?.(row.id).catch(() => undefined)
    return { ok: true, documentId: row.id, folio: result.folio }
  } catch (error) {
    // Validación (datos mal escritos): no se arregla solo. Red o servicio: se reintenta.
    const retryable = error instanceof OpenFacturaError ? error.retryable : true
    await deps.service.updateBillingDocuments({ id: row.id, lines: lines as unknown as Record<string, unknown> })
    return failure(deps, row, error, retryable)
  }
}

// Anula un documento emitido con una nota de crédito (devolución o cancelación).
export const issueCreditNote = async (
  deps: BillingDeps,
  documentId: string,
  reason: string,
): Promise<IssueResult> => {
  const now = deps.now ?? new Date()
  const [original] = await deps.service.listBillingDocuments({ id: documentId })
  if (!original || original.state !== "issued" || !original.folio || original.kind === "nota_credito") {
    return { ok: false, error: "Solo se puede anular un documento ya emitido." }
  }
  const [already] = (await deps.service.listBillingDocuments({ voids_document_id: documentId })).filter(
    (doc) => doc.state === "issued",
  )
  if (already) {
    return { ok: true, alreadyIssued: true, documentId: already.id, folio: already.folio }
  }
  // El servicio de boletas de Garage360 no emite notas de crédito por API: se registra la anulación y la nota se emite a
  // mano en el portal del SII.
  if (deps.api.requestCancellation) {
    return requestManualCreditNote(deps, original, reason, now)
  }
  if (!deps.emisor) {
    return { ok: false, error: "Faltan los datos tributarios del emisor (variables BILLING_EMISOR_*)." }
  }

  const row =
    (await deps.service.listBillingDocuments({ voids_document_id: documentId }))[0] ??
    (await deps.service.createBillingDocuments({
      medusa_order_id: original.medusa_order_id,
      kind: "nota_credito",
      tipo_dte: DTE.NOTA_CREDITO,
      state: "pending",
      total: original.total,
      receptor: original.receptor,
      voids_document_id: documentId,
      attempts: 0,
      first_attempt_at: now,
    }))

  await deps.service.updateBillingDocuments({ id: row.id, attempts: (row.attempts ?? 0) + 1, last_attempt_at: now })
  try {
    const request = buildCreditNote({
      original: {
        type: original.tipo_dte,
        folio: original.folio,
        date: original.emission_date ?? emissionDate(new Date(original.issued_at ?? now)),
        lines: (original.lines ?? []) as unknown as DteLine[],
        total: original.total,
      },
      emisor: deps.emisor,
      receptor: (original.receptor ?? null) as unknown as Receptor | null,
      reason,
      date: now,
    })
    const result = await deps.api.emit(request, idempotencyKey(original.id, "nota_credito"))
    await deps.service.updateBillingDocuments({
      id: row.id,
      state: "issued",
      folio: result.folio,
      token: result.token,
      sii_status: "Pendiente",
      emission_date: emissionDate(now),
      issued_at: now,
      last_error: null,
    })
    return { ok: true, documentId: row.id, folio: result.folio }
  } catch (error) {
    const retryable = error instanceof OpenFacturaError ? error.retryable : true
    return failure(deps, row, error, retryable)
  }
}

type Original = Awaited<ReturnType<Service["listBillingDocuments"]>>[number]

// Anulación sin nota de crédito por API. Una boleta electrónica se anula con una Nota de Crédito electrónica; Garage360
// está inscrita solo en boletas, así que la emite una persona en el portal del SII (Servicios online > Boleta de ventas y
// servicios electrónica > Emitir nota de crédito electrónica). Aquí se registra la solicitud en el servicio de boletas, se
// deja un registro en la tienda y se avisa; después se confirma con el folio de la nota (confirmManualCreditNote).
const requestManualCreditNote = async (
  deps: BillingDeps,
  original: Original,
  reason: string,
  now: Date,
): Promise<IssueResult> => {
  const [existing] = await deps.service.listBillingDocuments({ voids_document_id: original.id })
  if (existing?.state === "manual_pending") {
    return { ok: true, manual: true, documentId: existing.id, folio: null }
  }

  const row =
    existing ??
    (await deps.service.createBillingDocuments({
      medusa_order_id: original.medusa_order_id,
      kind: "nota_credito",
      tipo_dte: DTE.NOTA_CREDITO,
      state: "pending",
      total: original.total,
      receptor: original.receptor,
      voids_document_id: original.id,
      attempts: 0,
      first_attempt_at: now,
    }))
  await deps.service.updateBillingDocuments({ id: row.id, attempts: (row.attempts ?? 0) + 1, last_attempt_at: now })

  try {
    const { instructions } = await deps.api.requestCancellation!(original.folio as number, reason)
    await deps.service.updateBillingDocuments({ id: row.id, state: "manual_pending", last_error: null, retryable: false })
    await deps.onManualCreditNote?.(row.id, instructions).catch(() => undefined)
    return { ok: true, manual: true, documentId: row.id, folio: null, instructions }
  } catch (error) {
    const retryable = error instanceof OpenFacturaError ? error.retryable : true
    return failure(deps, row, error, retryable)
  }
}

// Registra la nota de crédito que una persona ya emitió en el portal del SII. A partir de ahí el documento figura anulado.
// La nota la emite el propio SII, así que queda aceptada.
export const confirmManualCreditNote = async (
  deps: BillingDeps,
  documentId: string,
  creditNoteFolio: number,
  date?: string,
): Promise<IssueResult> => {
  const now = deps.now ?? new Date()
  if (!deps.api.confirmCancellation) {
    return { ok: false, error: "Este proveedor emite las notas de crédito por API: no hay nada que confirmar." }
  }
  const [row] = await deps.service.listBillingDocuments({ voids_document_id: documentId })
  const [original] = await deps.service.listBillingDocuments({ id: documentId })
  if (!row || row.kind !== "nota_credito" || !original?.folio) {
    return { ok: false, error: "Ese documento no tiene una anulación solicitada." }
  }
  if (row.state === "issued") {
    return row.folio === creditNoteFolio
      ? { ok: true, alreadyIssued: true, documentId: row.id, folio: row.folio }
      : { ok: false, error: `Ese documento ya fue anulado con la nota de crédito ${row.folio}.` }
  }
  if (row.state !== "manual_pending") {
    return { ok: false, error: "La anulación de ese documento no está pendiente." }
  }

  try {
    await deps.api.confirmCancellation(original.folio, creditNoteFolio, date)
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
  await deps.service.updateBillingDocuments({
    id: row.id,
    state: "issued",
    folio: creditNoteFolio,
    sii_status: "Aceptado",
    emission_date: date ?? emissionDate(now),
    issued_at: now,
    last_error: null,
  })
  return { ok: true, documentId: row.id, folio: creditNoteFolio }
}

// Consulta al SII (vía OpenFactura) los documentos que aún no están aceptados. Un rechazo se avisa.
export const pollSiiStatus = async (
  deps: BillingDeps,
  options: { onRejected?: (documentId: string) => Promise<void> } = {},
) => {
  const now = deps.now ?? new Date()
  const docs = await deps.service.listBillingDocuments({ state: "issued" })
  let checked = 0
  let rejected = 0

  for (const doc of docs) {
    const settled = doc.sii_status === "Aceptado" || doc.sii_status === "Aceptado con Reparo" || doc.sii_status === "Rechazado"
    const fresh = doc.issued_at && now.getTime() - new Date(doc.issued_at).getTime() < 72 * 3_600_000
    if (!doc.token || settled || !fresh) {
      continue
    }
    checked++
    const status = await deps.api.getStatus(doc.token)
    if (status !== doc.sii_status) {
      await deps.service.updateBillingDocuments({ id: doc.id, sii_status: status })
    }
    if (status === "Rechazado") {
      rejected++
      await options.onRejected?.(doc.id).catch(() => undefined)
    }
  }
  return { checked, rejected }
}

// Documentos que fallaron por un problema pasajero (red, servicio, límite de peticiones) se reintentan
// con espera creciente. Los de datos inválidos no: esos esperan una revisión manual.
export const retryFailed = async (
  deps: BillingDeps,
  loadOrder: (orderId: string) => Promise<OrderForBilling | null>,
) => {
  const now = deps.now ?? new Date()
  const docs = await deps.service.listBillingDocuments({ state: ["pending", "failed"] })
  let retried = 0

  for (const doc of docs) {
    if (doc.kind === "nota_credito" || !doc.retryable || (doc.attempts ?? 0) >= MAX_ATTEMPTS) {
      continue
    }
    const waitMs = Math.min(((doc.attempts ?? 1) ** 2) * 2 * 60_000, 60 * 60_000)
    if (doc.last_attempt_at && now.getTime() - new Date(doc.last_attempt_at).getTime() < waitMs) {
      continue
    }
    const order = await loadOrder(doc.medusa_order_id)
    if (!order) {
      continue
    }
    retried++
    await issueDocument(deps, order)
  }
  return { retried }
}
