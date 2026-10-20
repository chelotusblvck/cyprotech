import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { INTCOMEX_MODULE } from "../../../../modules/intcomex"
import type IntcomexModuleService from "../../../../modules/intcomex/service"
import { isSyncRunning, runSync } from "../../../../modules/intcomex/sync/run"

const bodySchema = z.object({
  kind: z.enum(["catalog", "prices", "inventory"]),
  limit: z.number().int().positive().optional(),
  dryRun: z.boolean().optional(),
})

// Lanza una sincronización a mano. Las corridas reales se ejecutan en segundo plano porque el
// catálogo completo puede tardar minutos; el avance queda en el estado (lastRuns).
// Un dry-run responde de inmediato con lo que haría, sin escribir nada.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "Parámetros inválidos", issues: parsed.error.issues })
    return
  }
  const { kind, limit, dryRun } = parsed.data
  const service: IntcomexModuleService = req.scope.resolve(INTCOMEX_MODULE)

  if (await isSyncRunning(service, kind)) {
    res.status(409).json({ message: `Ya hay una sincronización de ${kind} en curso.` })
    return
  }

  if (dryRun) {
    const { stats } = await runSync(kind, req.scope, { limit, dryRun })
    res.json({ started: false, stats })
    return
  }

  runSync(kind, req.scope, { limit }).catch((error) => {
    req.scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(`Sincronización ${kind} falló: ${(error as Error).message}`)
  })
  res.status(202).json({ started: true, kind })
}
