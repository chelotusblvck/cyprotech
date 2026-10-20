import { MedusaError } from "@medusajs/framework/utils"

import type LedgerModuleService from "./service"
import {
  DEFAULT_SETTINGS,
  computeClose,
  earnedEntries,
  isValidPeriod,
  nextPeriod,
  orderEconomics,
  pendingFixedCosts,
  periodOf,
  reversalEntries,
  round2,
  sumEntries,
  validateSettings,
  type EntryDraft,
  type EntryKind,
  type LedgerSettingsData,
  type LineSnapshot,
  type OrderEconomics,
} from "./logic"

type Service = LedgerModuleService

// ── Configuración ──────────────────────────────────────────────────────────

const toSettings = (row: Awaited<ReturnType<Service["listLedgerSettings"]>>[number]): LedgerSettingsData => ({
  partnerA: { key: "a", name: row.partner_a_name, percent: row.partner_a_percent },
  partnerB: { key: "b", name: row.partner_b_name, percent: row.partner_b_percent },
  gatewayFeePercent: row.gateway_fee_percent,
  gatewayFeeFixed: row.gateway_fee_fixed,
  gatewayFeeReportedWithIva: row.gateway_fee_reported_with_iva,
  holdDays: row.hold_days,
  carryDeficit: row.carry_deficit,
  fixedCosts: (row.fixed_costs as LedgerSettingsData["fixedCosts"] | null) ?? [],
})

const toRow = (settings: LedgerSettingsData) => ({
  partner_a_name: settings.partnerA.name,
  partner_a_percent: settings.partnerA.percent,
  partner_b_name: settings.partnerB.name,
  partner_b_percent: settings.partnerB.percent,
  gateway_fee_percent: settings.gatewayFeePercent,
  gateway_fee_fixed: settings.gatewayFeeFixed,
  gateway_fee_reported_with_iva: settings.gatewayFeeReportedWithIva,
  hold_days: settings.holdDays,
  carry_deficit: settings.carryDeficit,
  fixed_costs: settings.fixedCosts as unknown as Record<string, unknown>,
})

export const getSettings = async (service: Service): Promise<LedgerSettingsData> => {
  const [row] = await service.listLedgerSettings({ key: "default" })
  if (row) {
    return toSettings(row)
  }
  await service.createLedgerSettings({ key: "default", ...toRow(DEFAULT_SETTINGS) })
  return DEFAULT_SETTINGS
}

export const saveSettings = async (service: Service, settings: LedgerSettingsData) => {
  validateSettings(settings)
  const [row] = await service.listLedgerSettings({ key: "default" })
  if (row) {
    await service.updateLedgerSettings({ id: row.id, ...toRow(settings) })
  } else {
    await service.createLedgerSettings({ key: "default", ...toRow(settings) })
  }
  return settings
}

// ── Períodos ───────────────────────────────────────────────────────────────

// Primer período abierto desde el mes de la fecha. Un asiento nunca cae en un mes ya cerrado.
export const openPeriodFor = async (service: Service, date: Date) => {
  let period = periodOf(date)
  for (;;) {
    const [row] = await service.listLedgerPeriods({ period })
    if (!row || row.status !== "closed") {
      return period
    }
    period = nextPeriod(period)
  }
}

const bookEntries = async (service: Service, period: string, drafts: EntryDraft[]) => {
  if (drafts.length === 0) {
    return []
  }
  return service.createLedgerEntries(
    drafts.map((draft) => ({
      period,
      kind: draft.kind,
      amount: draft.amount,
      order_id: draft.order_id ?? null,
      description: draft.description,
      source: draft.source ?? null,
    })),
  )
}

// ── Pedidos ────────────────────────────────────────────────────────────────

export type PlacedOrderInput = {
  orderId: string
  displayId: string
  lines: LineSnapshot[]
  // Total que pagó el cliente (CLP, IVA y despacho incluidos): base de la comisión de la pasarela.
  totalPaid: number
  // Comisión real que informó la pasarela (Flow). Si falta, se estima con el porcentaje configurado.
  actualFee?: number | null
  ivaPercent?: number
}

// Se llama cuando el pedido queda colocado en Intcomex. Es idempotente.
export const recordPlacedOrder = async (service: Service, input: PlacedOrderInput) => {
  const [existing] = await service.listLedgerOrders({ medusa_order_id: input.orderId })
  if (existing) {
    return existing
  }
  const settings = await getSettings(service)
  const economics = orderEconomics(
    input.lines,
    input.totalPaid,
    settings,
    typeof input.actualFee === "number"
      ? { fee: input.actualFee, includesIva: settings.gatewayFeeReportedWithIva, ivaPercent: input.ivaPercent ?? 19 }
      : null,
  )
  return service.createLedgerOrders({
    medusa_order_id: input.orderId,
    display_id: input.displayId,
    state: "pending",
    economics: economics as unknown as Record<string, unknown>,
  })
}

export const markDelivered = async (service: Service, orderId: string, at: Date = new Date()) => {
  const [order] = await service.listLedgerOrders({ medusa_order_id: orderId })
  if (!order || order.delivered_at || order.state !== "pending") {
    return null
  }
  return service.updateLedgerOrders({ id: order.id, delivered_at: at })
}

// Reconoce la utilidad de los pedidos entregados cuyo plazo de retracto ya venció.
export const releaseDueOrders = async (service: Service, now: Date = new Date()) => {
  const settings = await getSettings(service)
  const cutoff = new Date(now.getTime() - settings.holdDays * 86_400_000)
  const pending = await service.listLedgerOrders({ state: "pending" })
  let released = 0

  for (const order of pending) {
    if (!order.delivered_at || new Date(order.delivered_at) > cutoff) {
      continue
    }
    const period = await openPeriodFor(service, now)
    const source = `order:${order.medusa_order_id}:earned`
    const [booked] = await service.listLedgerEntries({ source })
    if (!booked) {
      const economics = order.economics as unknown as OrderEconomics
      await bookEntries(
        service,
        period,
        earnedEntries(order.medusa_order_id, order.display_id, economics).map((entry) => ({
          ...entry,
          source: entry.kind === "margin" ? source : `${source}:fee`,
        })),
      )
    }
    await service.updateLedgerOrders({ id: order.id, state: "earned", earned_at: now, period })
    released++
  }
  return released
}

// Cancelación o devolución. Si la utilidad aún no se reconocía, el pedido simplemente se anula;
// si ya estaba reconocida, se registra una reversa en el período abierto.
export const reverseOrder = async (service: Service, orderId: string, now: Date = new Date()) => {
  const [order] = await service.listLedgerOrders({ medusa_order_id: orderId })
  if (!order || order.state === "void" || order.state === "reversed") {
    return null
  }
  if (order.state === "pending") {
    return service.updateLedgerOrders({ id: order.id, state: "void", reversed_at: now })
  }
  const period = await openPeriodFor(service, now)
  const source = `order:${orderId}:reversal`
  const [booked] = await service.listLedgerEntries({ source })
  if (!booked) {
    await bookEntries(
      service,
      period,
      reversalEntries(orderId, order.display_id, order.economics as unknown as OrderEconomics).map((entry) => ({
        ...entry,
        source,
      })),
    )
  }
  return service.updateLedgerOrders({ id: order.id, state: "reversed", reversed_at: now })
}

// ── Asientos manuales ──────────────────────────────────────────────────────

export const addManualEntry = async (
  service: Service,
  input: { kind: "expense" | "adjustment"; amount: number; description: string; period?: string },
  now: Date = new Date(),
) => {
  if (!Number.isFinite(input.amount) || input.amount === 0) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "El monto debe ser distinto de cero.")
  }
  if (!input.description.trim()) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Falta la descripción.")
  }
  let period = input.period ?? (await openPeriodFor(service, now))
  if (!isValidPeriod(period)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Período inválido: ${period}`)
  }
  const [row] = await service.listLedgerPeriods({ period })
  if (row?.status === "closed") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `El período ${period} está cerrado. Registra el ajuste en el período abierto.`,
    )
  }
  period = input.period ?? period
  // Un gasto se ingresa en positivo y se registra restando utilidad.
  const amount = input.kind === "expense" ? -Math.abs(input.amount) : input.amount
  const [entry] = await bookEntries(service, period, [
    { kind: input.kind as EntryKind, amount: round2(amount), description: input.description.trim() },
  ])
  return entry
}

// ── Cierre ─────────────────────────────────────────────────────────────────

const periodsWithEntries = async (service: Service) => {
  const entries = await service.listLedgerEntries({}, { select: ["period"] })
  return [...new Set(entries.map((entry) => entry.period))].sort()
}

export const closePeriod = async (
  service: Service,
  period: string,
  options: { now?: Date; force?: boolean } = {},
) => {
  const now = options.now ?? new Date()
  if (!isValidPeriod(period)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Período inválido: ${period}`)
  }
  if (period >= periodOf(now) && !options.force) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `El mes ${period} todavía no termina. Ciérralo cuando termine o fuerza el cierre.`,
    )
  }

  const [existing] = await service.listLedgerPeriods({ period })
  if (existing?.status === "closed") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `El período ${period} ya está cerrado.`)
  }

  const closed = await service.listLedgerPeriods({ status: "closed" })
  const closedSet = new Set(closed.map((row) => row.period))
  const earlierOpen = (await periodsWithEntries(service)).find((p) => p < period && !closedSet.has(p))
  if (earlierOpen) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `Cierra primero el período ${earlierOpen}.`)
  }

  const settings = await getSettings(service)
  const sources = (await service.listLedgerEntries({ period })).flatMap((entry) => (entry.source ? [entry.source] : []))
  await bookEntries(service, period, pendingFixedCosts(period, settings, sources))

  const entries = await service.listLedgerEntries({ period })
  const previous = closed.filter((row) => row.period < period).sort((a, b) => (a.period < b.period ? 1 : -1))[0]
  const { totals, payouts } = computeClose(
    entries.map((entry) => ({ kind: entry.kind as EntryKind, amount: entry.amount })),
    settings,
    previous?.deficit_out ?? 0,
  )

  const data = {
    status: "closed",
    totals: totals as unknown as Record<string, unknown>,
    deficit_in: totals.deficitIn,
    deficit_out: totals.deficitOut,
    closed_at: now,
  }
  const row = existing
    ? await service.updateLedgerPeriods({ id: existing.id, ...data })
    : await service.createLedgerPeriods({ period, ...data })

  const created = await service.createLedgerPayouts(
    payouts
      .filter((payout) => payout.amount > 0)
      .map((payout) => ({
        period,
        partner: payout.partner,
        partner_name: payout.name,
        percent: payout.percent,
        amount: payout.amount,
        status: "pending",
      })),
  )
  return { period: row, totals, payouts: created }
}

export const payPayout = async (service: Service, payoutId: string, reference: string | null, now = new Date()) => {
  const [payout] = await service.listLedgerPayouts({ id: payoutId })
  if (!payout) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `No existe el pago ${payoutId}.`)
  }
  if (payout.status === "paid") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Este pago ya está marcado como pagado.")
  }
  return service.updateLedgerPayouts({ id: payout.id, status: "paid", paid_at: now, reference: reference?.trim() || null })
}

// ── Resumen ────────────────────────────────────────────────────────────────

export const periodSummary = async (service: Service, period: string, now: Date = new Date()) => {
  if (!isValidPeriod(period)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Período inválido: ${period}`)
  }
  const settings = await getSettings(service)
  const [row] = await service.listLedgerPeriods({ period })
  const entries = await service.listLedgerEntries({ period }, { order: { created_at: "ASC" } })
  const payouts = await service.listLedgerPayouts({ period })

  const closed = await service.listLedgerPeriods({ status: "closed" })
  const previous = closed.filter((r) => r.period < period).sort((a, b) => (a.period < b.period ? 1 : -1))[0]

  const live = entries.map((entry) => ({ kind: entry.kind as EntryKind, amount: entry.amount }))
  // Para un período abierto se proyectan también los costos fijos que se registrarán al cerrar.
  const projected = row?.status === "closed" ? [] : pendingFixedCosts(period, settings, entries.flatMap((e) => (e.source ? [e.source] : [])))
  const preview = computeClose([...live, ...projected], settings, previous?.deficit_out ?? 0)

  const pending = await service.listLedgerOrders({ state: "pending" })
  const pendingMargin = round2(
    pending.reduce((sum, order) => sum + ((order.economics as unknown as OrderEconomics).contribution ?? 0), 0),
  )

  return {
    period,
    status: row?.status ?? "open",
    isCurrent: period === periodOf(now),
    settings,
    booked: sumEntries(live),
    totals: row?.status === "closed" ? row.totals : preview.totals,
    projectedFixedCosts: projected.map((entry) => ({ description: entry.description, amount: entry.amount })),
    payouts: row?.status === "closed" ? payouts : preview.payouts.map((p) => ({ ...p, status: "projected" })),
    closedPayouts: payouts,
    entries,
    pending: { orders: pending.length, expectedContribution: pendingMargin },
    gatewayFeeConfigured: settings.gatewayFeePercent > 0 || settings.gatewayFeeFixed > 0,
  }
}
