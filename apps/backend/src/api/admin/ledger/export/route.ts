import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { LEDGER_MODULE } from "../../../../modules/ledger"
import { isValidPeriod, toCsv } from "../../../../modules/ledger/logic"
import { periodSummary } from "../../../../modules/ledger/operations"
import type LedgerModuleService from "../../../../modules/ledger/service"

const KIND_LABEL: Record<string, string> = {
  margin: "Margen de pedido",
  gateway_fee: "Comisión pasarela",
  reversal: "Reversa",
  expense: "Gasto",
  adjustment: "Ajuste",
}

// CSV del período para contabilidad: asientos y reparto entre socios.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const period = req.query.period as string | undefined
  if (!period || !isValidPeriod(period)) {
    res.status(400).json({ message: "Indica el período como AAAA-MM." })
    return
  }
  const ledger: LedgerModuleService = req.scope.resolve(LEDGER_MODULE)
  const summary = await periodSummary(ledger, period)

  const rows: (string | number | null)[][] = [
    ["Período", period, "Estado", summary.status],
    [],
    ["Fecha", "Tipo", "Descripción", "Pedido", "Monto CLP (neto)"],
    ...summary.entries.map((entry) => [
      new Date(entry.created_at).toISOString().slice(0, 10),
      KIND_LABEL[entry.kind] ?? entry.kind,
      entry.description,
      entry.order_id,
      entry.amount,
    ]),
    [],
    ["Utilidad neta", summary.totals ? (summary.totals as { netProfit: number }).netProfit : null],
    [],
    ["Socio", "Porcentaje", "Monto CLP", "Estado"],
    ...summary.payouts.map((payout) => [
      payout.name ?? (payout as { partner_name?: string }).partner_name ?? "",
      payout.percent,
      payout.amount,
      (payout as { status?: string }).status ?? "",
    ]),
  ]

  res.setHeader("Content-Type", "text/csv; charset=utf-8")
  res.setHeader("Content-Disposition", `attachment; filename="ledger-${period}.csv"`)
  // BOM para que Excel abra bien las tildes.
  res.send("﻿" + toCsv(rows))
}
