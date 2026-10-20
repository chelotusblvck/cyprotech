import { MedusaError } from "@medusajs/framework/utils"
import { fetchUsdClp, type FxQuote } from "../../../lib/pricing"

type FxStore = {
  listIntcomexFxRates: (
    filters?: Record<string, unknown>,
    config?: Record<string, unknown>,
  ) => Promise<{ date: string; rate: number; source: string }[]>
  createIntcomexFxRates: (data: { date: string; rate: number; source: string }) => Promise<unknown>
}

export type ResolvedFx = FxQuote & {
  // True si no se pudo traer el valor de hoy y se usa el último guardado.
  stale: boolean
}

// Orden de preferencia: override manual (FX_USD_CLP_OVERRIDE), valor de hoy guardado,
// valor nuevo de mindicador.cl y, si la red falla, el último valor guardado.
export const resolveUsdClp = async (
  store: FxStore,
  options: {
    env?: NodeJS.ProcessEnv
    now?: Date
    fetchQuote?: () => Promise<FxQuote>
  } = {},
): Promise<ResolvedFx> => {
  const env = options.env ?? process.env
  const now = options.now ?? new Date()
  const fetchQuote = options.fetchQuote ?? (() => fetchUsdClp())

  const override = Number(env.FX_USD_CLP_OVERRIDE)
  if (Number.isFinite(override) && override > 0) {
    return { rate: override, date: now.toISOString().slice(0, 10), source: "override", stale: false }
  }

  const today = now.toISOString().slice(0, 10)
  const [existing] = await store.listIntcomexFxRates({ date: today })
  if (existing) {
    return { rate: existing.rate, date: existing.date, source: existing.source, stale: false }
  }

  try {
    const quote = await fetchQuote()
    // mindicador entrega la fecha del último dato publicado; se guarda bajo la fecha de hoy
    // para no volver a consultar durante el día.
    await store.createIntcomexFxRates({ date: today, rate: quote.rate, source: quote.source })
    return { ...quote, date: today, stale: false }
  } catch (error) {
    const [latest] = await store.listIntcomexFxRates({}, { order: { date: "DESC" }, take: 1 })
    if (latest) {
      return { rate: latest.rate, date: latest.date, source: latest.source, stale: true }
    }
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, 
      `No se pudo obtener el tipo de cambio USD/CLP y no hay uno guardado: ${(error as Error).message}`,
    )
  }
}
