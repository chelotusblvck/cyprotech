import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

import { runSync, type SyncKind } from "../modules/intcomex/sync/run"

// Uso (desde apps/backend):
//   npx medusa exec ./src/scripts/sync-intcomex.ts catalog [dry-run] [limit=50]
//   npx medusa exec ./src/scripts/sync-intcomex.ts prices
//   npx medusa exec ./src/scripts/sync-intcomex.ts inventory
export default async function syncIntcomex({ container, args = [] }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const kind = (args.find((arg) => !arg.includes("=") && arg !== "dry-run") ?? "catalog") as SyncKind
  if (!["catalog", "prices", "inventory"].includes(kind)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Tipo de sincronización desconocido: ${kind}`)
  }

  const limitArg = args.find((arg) => arg.startsWith("limit="))
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined
  const dryRun = args.includes("dry-run")

  const { runId, stats } = await runSync(kind, container, { limit, dryRun })
  logger.info(`Sincronización ${kind} (${runId}): ${JSON.stringify(stats)}`)
}
