import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import { LEDGER_MODULE } from "../../../../modules/ledger"
import { getSettings, saveSettings } from "../../../../modules/ledger/operations"
import type LedgerModuleService from "../../../../modules/ledger/service"

const partner = (key: "a" | "b") =>
  z.object({ key: z.literal(key).default(key), name: z.string().min(1).max(60), percent: z.number().min(0).max(100) })

const bodySchema = z.object({
  partnerA: partner("a"),
  partnerB: partner("b"),
  gatewayFeePercent: z.number().min(0).max(99),
  gatewayFeeFixed: z.number().min(0),
  gatewayFeeReportedWithIva: z.boolean().default(false),
  holdDays: z.number().int().min(0).max(365),
  carryDeficit: z.boolean(),
  fixedCosts: z.array(z.object({ name: z.string().min(1).max(80), amount: z.number().min(0) })).max(20),
})

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ledger: LedgerModuleService = req.scope.resolve(LEDGER_MODULE)
  res.json({ settings: await getSettings(ledger) })
}

// Los cambios aplican a los pedidos que se coloquen desde ahora y a los cierres futuros;
// los pedidos ya registrados conservan la comisión con la que se calcularon.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "Parámetros inválidos", issues: parsed.error.issues })
    return
  }
  const ledger: LedgerModuleService = req.scope.resolve(LEDGER_MODULE)
  try {
    res.json({ settings: await saveSettings(ledger, parsed.data) })
  } catch (error) {
    res.status(400).json({ message: (error as Error).message })
  }
}
