import { MedusaError } from "@medusajs/framework/utils"

// Lógica pura del ledger de socios. Todos los montos son CLP netos (sin IVA): el IVA es un
// traspaso al SII y no es utilidad. Un monto positivo suma a la utilidad; uno negativo la resta.

export type Partner = { key: "a" | "b"; name: string; percent: number }

export type LedgerSettingsData = {
  partnerA: Partner
  partnerB: Partner
  // Comisión de la pasarela (Flow) sobre lo que paga el cliente, sin IVA.
  gatewayFeePercent: number
  gatewayFeeFixed: number
  // Si la comisión que informa Flow en cada pago ya incluye el IVA (se descuenta para trabajar en neto).
  gatewayFeeReportedWithIva: boolean
  // Días después de la entrega antes de reconocer la utilidad (plazo de retracto).
  holdDays: number
  // Una pérdida del período se descuenta de las utilidades siguientes antes de repartir.
  carryDeficit: boolean
  // Costos fijos mensuales que se registran solos al cerrar el período.
  fixedCosts: { name: string; amount: number }[]
}

export const DEFAULT_SETTINGS: LedgerSettingsData = {
  partnerA: { key: "a", name: "Garage360", percent: 50 },
  partnerB: { key: "b", name: "2Pro", percent: 50 },
  // Flow cobra 2,89% + IVA con abono al tercer día hábil (3,19% + IVA al día siguiente).
  gatewayFeePercent: 2.89,
  gatewayFeeFixed: 0,
  gatewayFeeReportedWithIva: false,
  holdDays: 10,
  carryDeficit: true,
  fixedCosts: [{ name: "OpenFactura (Haulmer)", amount: 9990 }],
}

export type EntryKind = "margin" | "gateway_fee" | "reversal" | "expense" | "adjustment"

export type EntryDraft = {
  kind: EntryKind
  amount: number
  order_id?: string | null
  description: string
  source?: string | null
}

export type LineSnapshot = {
  unitNetSale: number
  costNetClpPerUnit: number
  quantity: number
}

export type OrderEconomics = {
  revenueNet: number
  costNet: number
  grossMargin: number
  gatewayFee: number
  // Margen después de la comisión de la pasarela, antes de costos fijos.
  contribution: number
  totalPaid: number
  // "flow" si la comisión es la que informó Flow en el pago; "estimate" si se calculó con el porcentaje.
  feeSource: "flow" | "estimate"
}

// Comisión real informada por la pasarela para este pedido.
export type ActualFee = { fee: number; includesIva: boolean; ivaPercent: number }

export const round2 = (value: number) => Math.round(value * 100) / 100

export const validateSettings = (settings: LedgerSettingsData) => {
  const total = settings.partnerA.percent + settings.partnerB.percent
  if (Math.abs(total - 100) > 1e-9) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Los porcentajes de los socios deben sumar 100 (suman ${total}).`,
    )
  }
  for (const value of [settings.gatewayFeePercent, settings.gatewayFeeFixed, settings.holdDays]) {
    if (!Number.isFinite(value) || value < 0) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Comisión y días deben ser números positivos.")
    }
  }
  if (settings.gatewayFeePercent >= 100) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "La comisión de la pasarela no puede ser 100% o más.")
  }
}

// Mes calendario en hora de Chile (el cierre mensual se piensa en hora local).
export const periodOf = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value
  return `${get("year")}-${get("month")}`
}

export const nextPeriod = (period: string) => {
  const [year, month] = period.split("-").map(Number)
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`
}

export const isValidPeriod = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value)

export const orderEconomics = (
  lines: LineSnapshot[],
  totalPaid: number,
  settings: Pick<LedgerSettingsData, "gatewayFeePercent" | "gatewayFeeFixed">,
  actual?: ActualFee | null,
): OrderEconomics => {
  const revenueNet = lines.reduce((sum, line) => sum + line.unitNetSale * line.quantity, 0)
  const costNet = lines.reduce((sum, line) => sum + line.costNetClpPerUnit * line.quantity, 0)
  const grossMargin = revenueNet - costNet
  const hasActual = actual !== undefined && actual !== null && Number.isFinite(actual.fee) && actual.fee >= 0
  const gatewayFee = hasActual
    ? actual.fee / (actual.includesIva ? 1 + actual.ivaPercent / 100 : 1)
    : (totalPaid * settings.gatewayFeePercent) / 100 + settings.gatewayFeeFixed
  return {
    revenueNet: round2(revenueNet),
    costNet: round2(costNet),
    grossMargin: round2(grossMargin),
    gatewayFee: round2(gatewayFee),
    contribution: round2(grossMargin - gatewayFee),
    totalPaid: round2(totalPaid),
    feeSource: hasActual ? "flow" : "estimate",
  }
}

// Asientos cuando un pedido pasa a utilidad reconocida (entregado y vencido el plazo de retracto).
export const earnedEntries = (orderId: string, displayId: string, economics: OrderEconomics): EntryDraft[] => {
  const entries: EntryDraft[] = [
    { kind: "margin", amount: economics.grossMargin, order_id: orderId, description: `Margen pedido ${displayId}` },
  ]
  if (economics.gatewayFee !== 0) {
    entries.push({
      kind: "gateway_fee",
      amount: -economics.gatewayFee,
      order_id: orderId,
      description: `Comisión pasarela pedido ${displayId}`,
    })
  }
  return entries
}

// Devolución de un pedido ya reconocido: se revierte el margen. La comisión de la pasarela
// no se recupera (Flow no la devuelve), así que esa pérdida se mantiene.
export const reversalEntries = (orderId: string, displayId: string, economics: OrderEconomics): EntryDraft[] => [
  {
    kind: "reversal",
    amount: -economics.grossMargin,
    order_id: orderId,
    description: `Reversa por devolución o cancelación pedido ${displayId}`,
  },
]

// Costos fijos del mes que todavía no se han registrado.
export const pendingFixedCosts = (
  period: string,
  settings: Pick<LedgerSettingsData, "fixedCosts">,
  existingSources: string[],
): EntryDraft[] =>
  settings.fixedCosts
    .filter((cost) => cost.amount > 0 && !existingSources.includes(`recurring:${cost.name}`))
    .map((cost) => ({
      kind: "expense" as const,
      amount: -cost.amount,
      description: `${cost.name} (${period})`,
      source: `recurring:${cost.name}`,
    }))

export type PeriodTotals = {
  grossMargin: number
  gatewayFees: number
  reversals: number
  expenses: number
  adjustments: number
  netProfit: number
  deficitIn: number
  distributable: number
  deficitOut: number
}

export type Payout = { partner: "a" | "b"; name: string; percent: number; amount: number }

export const sumEntries = (entries: { kind: EntryKind; amount: number }[]) => {
  const by = (kind: EntryKind) => round2(entries.filter((entry) => entry.kind === kind).reduce((s, e) => s + e.amount, 0))
  const grossMargin = by("margin")
  const gatewayFees = by("gateway_fee")
  const reversals = by("reversal")
  const expenses = by("expense")
  const adjustments = by("adjustment")
  return {
    grossMargin,
    gatewayFees,
    reversals,
    expenses,
    adjustments,
    netProfit: round2(grossMargin + gatewayFees + reversals + expenses + adjustments),
  }
}

// Utilidad neta del período y su reparto. Si hubo pérdida (y carryDeficit está activo) no se
// paga nada y la pérdida se arrastra al período siguiente; las pérdidas anteriores se
// recuperan primero con las utilidades siguientes.
export const computeClose = (
  entries: { kind: EntryKind; amount: number }[],
  settings: LedgerSettingsData,
  deficitIn = 0,
): { totals: PeriodTotals; payouts: Payout[] } => {
  validateSettings(settings)
  const base = sumEntries(entries)
  const available = round2(base.netProfit - (settings.carryDeficit ? deficitIn : 0))

  const distributable = available > 0 ? available : 0
  const deficitOut = settings.carryDeficit && available < 0 ? round2(-available) : 0

  const amountA = round2((distributable * settings.partnerA.percent) / 100)
  const amountB = round2(distributable - amountA)

  return {
    totals: {
      ...base,
      deficitIn: settings.carryDeficit ? deficitIn : 0,
      distributable,
      deficitOut,
    },
    payouts: [
      { partner: "a", name: settings.partnerA.name, percent: settings.partnerA.percent, amount: amountA },
      { partner: "b", name: settings.partnerB.name, percent: settings.partnerB.percent, amount: amountB },
    ],
  }
}

export const toCsv = (rows: (string | number | null | undefined)[][]) =>
  rows
    .map((row) =>
      row
        .map((cell) => {
          const text = cell === null || cell === undefined ? "" : String(cell)
          return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
        })
        .join(","),
    )
    .join("\n")
