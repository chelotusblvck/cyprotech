import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { loadPricingConfig } from "../../../../lib/pricing"
import { BILLING_MODULE } from "../../../../modules/billing"
import { loadEmisor, loadOpenFacturaConfig } from "../../../../modules/billing/client"
import { documentUrl } from "../../../../modules/billing/runtime"
import type BillingModuleService from "../../../../modules/billing/service"
import { loadSmtpConfig } from "../../../../modules/notification-smtp/config"
import { loadIntcomexConfig } from "../../../../modules/intcomex/client"
import { INTCOMEX_MODULE } from "../../../../modules/intcomex"
import type IntcomexModuleService from "../../../../modules/intcomex/service"
import { minStockFromEnv } from "../../../../modules/intcomex/sync/run"
import { LEDGER_MODULE } from "../../../../modules/ledger"
import { getSettings } from "../../../../modules/ledger/operations"
import { round2, type OrderEconomics } from "../../../../modules/ledger/logic"
import type LedgerModuleService from "../../../../modules/ledger/service"

type OrderRow = {
  id: string
  display_id: number
  created_at: string
  email: string | null
  total: number
  status: string
}

const dayKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)

type Alert = { level: "critical" | "warning" | "info"; message: string }

// Datos del dashboard de control: ventas, margen, pedidos con su estado en Intcomex y alertas.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const intcomex: IntcomexModuleService = req.scope.resolve(INTCOMEX_MODULE)
  const ledger: LedgerModuleService = req.scope.resolve(LEDGER_MODULE)
  const billing: BillingModuleService = req.scope.resolve(BILLING_MODULE)

  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)
  const now = new Date()
  const since = new Date(now.getTime() - days * 86_400_000)
  const iva = loadPricingConfig().ivaPercent

  const { data: orders } = (await query.graph({
    entity: "order",
    fields: ["id", "display_id", "created_at", "email", "total", "status"],
    filters: { created_at: { $gte: since } },
    pagination: { take: 2000, order: { created_at: "DESC" } },
  })) as unknown as { data: OrderRow[] }

  const ids = orders.map((order) => order.id)
  const [intcomexOrders, ledgerOrders, documents] = ids.length
    ? await Promise.all([
        intcomex.listIntcomexOrders({ medusa_order_id: ids }),
        ledger.listLedgerOrders({ medusa_order_id: ids }),
        billing.listBillingDocuments({ medusa_order_id: ids }),
      ])
    : [[], [], []]
  // Por pedido, su boleta o factura (la nota de crédito va aparte).
  const documentById = new Map(documents.filter((doc) => doc.kind !== "nota_credito").map((doc) => [doc.medusa_order_id, doc]))
  const creditNoteById = new Map(documents.filter((doc) => doc.kind === "nota_credito").map((doc) => [doc.medusa_order_id, doc]))
  const intcomexById = new Map(intcomexOrders.map((row) => [row.medusa_order_id, row]))
  const ledgerById = new Map(ledgerOrders.map((row) => [row.medusa_order_id, row]))

  // Serie diaria con todos los días del rango, también los sin ventas.
  const byDay = new Map<string, { orders: number; grossSales: number }>()
  for (let i = days - 1; i >= 0; i--) {
    byDay.set(dayKey(new Date(now.getTime() - i * 86_400_000)), { orders: 0, grossSales: 0 })
  }
  for (const order of orders) {
    const bucket = byDay.get(dayKey(new Date(order.created_at)))
    if (bucket) {
      bucket.orders++
      bucket.grossSales += order.total
    }
  }

  const active = ledgerOrders.filter((row) => row.state !== "void")
  const sum = (pick: (e: OrderEconomics) => number) =>
    round2(active.reduce((total, row) => total + pick(row.economics as unknown as OrderEconomics), 0))
  const grossSales = round2(orders.reduce((total, order) => total + order.total, 0))
  const productRevenueNet = sum((e) => e.revenueNet)
  const grossMargin = sum((e) => e.grossMargin)

  const settings = await getSettings(ledger)
  const config = loadIntcomexConfig()
  const minStock = minStockFromEnv()

  const [unmapped, lowStock] = await Promise.all([
    intcomex.listAndCountIntcomexProducts({ active: true, category_handle: null }, { take: 1 }),
    intcomex.listAndCountIntcomexProducts({ active: true, stock: { $lt: minStock } }, { take: 1 }),
  ])
  const [fx] = await intcomex.listIntcomexFxRates({}, { order: { date: "DESC" }, take: 1 })
  const lastRuns = await Promise.all(
    (["catalog", "prices", "inventory"] as const).map(async (kind) => {
      const [run] = await intcomex.listIntcomexSyncRuns({ kind }, { order: { started_at: "DESC" }, take: 1 })
      return run ? { kind, status: run.status, started_at: run.started_at, error: run.error } : { kind, status: "never" }
    }),
  )

  const openFactura = loadOpenFacturaConfig()
  const smtp = loadSmtpConfig()
  const [failedDocs, pendingDocs] = await Promise.all([
    billing.listAndCountBillingDocuments({ state: "failed" }, { take: 1 }),
    billing.listAndCountBillingDocuments({ state: "pending" }, { take: 1 }),
  ])

  const failedOrders = intcomexOrders.filter((row) => row.state === "failed")
  const notPlaced = orders.filter((order) => !intcomexById.has(order.id) && order.status !== "canceled")
  const stuck = notPlaced.filter((order) => now.getTime() - new Date(order.created_at).getTime() > 2 * 3_600_000)

  const alerts: Alert[] = []
  if (failedOrders.length) {
    alerts.push({
      level: "critical",
      message: `${failedOrders.length} pedido(s) fallaron al colocarse en Intcomex y requieren acción (reintento, reembolso o reemplazo).`,
    })
  }
  if (stuck.length) {
    alerts.push({
      level: "warning",
      message: `${stuck.length} pedido(s) llevan más de 2 horas sin colocarse en Intcomex.`,
    })
  }
  if (failedDocs[1] > 0) {
    alerts.push({
      level: "critical",
      message: `${failedDocs[1]} documento(s) tributario(s) no se pudieron emitir. Revisa el detalle en la tabla de pedidos.`,
    })
  }
  if (!smtp) {
    alerts.push({
      level: "critical",
      message: "El correo no está configurado: los clientes no están recibiendo confirmaciones ni boletas (falta SMTP_HOST).",
    })
  }
  if (openFactura && !loadEmisor()) {
    alerts.push({
      level: "critical",
      message: "Faltan los datos tributarios del emisor (BILLING_EMISOR_*): no se pueden emitir boletas.",
    })
  }
  if (settings.gatewayFeePercent === 0 && settings.gatewayFeeFixed === 0) {
    alerts.push({
      level: "warning",
      message: "No está configurada la comisión de Flow: la utilidad neta se está calculando sin ese costo.",
    })
  }
  for (const run of lastRuns) {
    if (run.status === "failed") {
      alerts.push({ level: "critical", message: `La última sincronización de ${run.kind} falló: ${run.error ?? "sin detalle"}.` })
    }
  }
  if (config && fx && fx.date !== dayKey(now)) {
    alerts.push({ level: "warning", message: `El tipo de cambio es del ${fx.date}; no se pudo actualizar hoy.` })
  }
  if (unmapped[1] > 0) {
    alerts.push({
      level: "info",
      message: `${unmapped[1]} producto(s) de Intcomex sin categoría reconocida están en borrador.`,
    })
  }
  if (!config) {
    alerts.push({
      level: "info",
      message: "Intcomex está en modo simulado: faltan las credenciales (API Key y Access Key).",
    })
  }
  if (!openFactura) {
    alerts.push({
      level: "info",
      message: "La boleta electrónica está en modo simulado: falta la API Key de OpenFactura.",
    })
  }

  res.json({
    days,
    kpis: {
      orders: orders.length,
      grossSales,
      netSales: round2(grossSales / (1 + iva / 100)),
      avgTicket: orders.length ? round2(grossSales / orders.length) : 0,
      productRevenueNet,
      grossMargin,
      marginPercent: productRevenueNet > 0 ? round2((grossMargin / productRevenueNet) * 100) : 0,
      expectedContribution: sum((e) => e.contribution),
      gatewayFees: sum((e) => e.gatewayFee),
      pendingPlacement: notPlaced.length,
    },
    daily: [...byDay.entries()].map(([date, value]) => ({ date, ...value, grossSales: round2(value.grossSales) })),
    recentOrders: orders.slice(0, 15).map((order) => {
      const icx = intcomexById.get(order.id)
      const led = ledgerById.get(order.id)
      const economics = led?.economics as unknown as OrderEconomics | undefined
      return {
        id: order.id,
        displayId: order.display_id,
        createdAt: order.created_at,
        email: order.email,
        total: order.total,
        status: order.status,
        intcomex: icx
          ? { state: icx.state, number: icx.intcomex_order_number, status: icx.status_description, error: icx.error }
          : null,
        ledger: led ? { state: led.state, grossMargin: economics?.grossMargin, contribution: economics?.contribution } : null,
        document: (() => {
          const doc = documentById.get(order.id)
          if (!doc) {
            return null
          }
          const note = creditNoteById.get(order.id)
          return {
            id: doc.id,
            kind: doc.kind,
            state: doc.state,
            folio: doc.folio,
            siiStatus: doc.sii_status,
            url: doc.token && doc.state === "issued" ? documentUrl(doc.token) : null,
            error: doc.state === "failed" ? doc.last_error : null,
            retryable: doc.retryable,
            emailed: Boolean(doc.emailed_at),
            voided: note?.state === "issued",
          }
        })(),
      }
    }),
    billing: {
      mode: openFactura ? "real" : "simulado",
      environment: openFactura?.environment ?? null,
      emisorConfigured: loadEmisor() !== null,
      failed: failedDocs[1],
      pending: pendingDocs[1],
    },
    email: {
      configured: smtp !== null,
      host: smtp ? (process.env.SMTP_HOST ? smtp.host : "Mailpit (desarrollo)") : null,
      from: smtp?.from ?? null,
    },
    intcomex: {
      mode: config ? "real" : "simulado",
      environment: config?.environment ?? null,
      fx: fx ? { rate: fx.rate, date: fx.date, source: fx.source } : null,
      lastRuns,
      catalogUnmapped: unmapped[1],
      catalogLowStock: lowStock[1],
      ordersFailed: failedOrders.length,
    },
    alerts,
  })
}
