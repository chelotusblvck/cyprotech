import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { LEDGER_MODULE } from "../../../../modules/ledger"
import { periodOf } from "../../../../modules/ledger/logic"
import type LedgerModuleService from "../../../../modules/ledger/service"

// Todos los períodos con movimiento (abiertos y cerrados) y los pagos de los cerrados.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ledger: LedgerModuleService = req.scope.resolve(LEDGER_MODULE)

  const [periods, payouts, entries] = await Promise.all([
    ledger.listLedgerPeriods({}),
    ledger.listLedgerPayouts({}),
    ledger.listLedgerEntries({}, { select: ["period"] }),
  ])

  const byPeriod = new Map(periods.map((row) => [row.period, row]))
  const all = new Set([...periods.map((row) => row.period), ...entries.map((entry) => entry.period), periodOf(new Date())])

  const rows = [...all]
    .sort()
    .reverse()
    .map((period) => ({
      period,
      status: byPeriod.get(period)?.status ?? "open",
      totals: byPeriod.get(period)?.totals ?? null,
      closed_at: byPeriod.get(period)?.closed_at ?? null,
      payouts: payouts.filter((payout) => payout.period === period),
    }))

  res.json({ periods: rows, currentPeriod: periodOf(new Date()) })
}
