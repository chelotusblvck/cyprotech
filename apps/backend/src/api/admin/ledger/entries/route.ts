import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

import { LEDGER_MODULE } from "../../../../modules/ledger"
import { addManualEntry } from "../../../../modules/ledger/operations"
import type LedgerModuleService from "../../../../modules/ledger/service"

const bodySchema = z.object({
  kind: z.enum(["expense", "adjustment"]),
  // Un gasto se ingresa en positivo; un ajuste lleva signo (positivo suma utilidad).
  amount: z.number(),
  description: z.string().min(1).max(200),
  period: z.string().optional(),
})

// Gasto o ajuste manual (hosting, comisiones extra, correcciones). Los asientos no se editan.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "Parámetros inválidos", issues: parsed.error.issues })
    return
  }
  const ledger: LedgerModuleService = req.scope.resolve(LEDGER_MODULE)
  try {
    const entry = await addManualEntry(ledger, parsed.data)
    res.status(201).json({ entry })
  } catch (error) {
    const status = error instanceof MedusaError && error.type === MedusaError.Types.NOT_ALLOWED ? 409 : 400
    res.status(status).json({ message: (error as Error).message })
  }
}
