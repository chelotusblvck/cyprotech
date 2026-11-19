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
  // Valor que trajo la red y se descartó por salirse de rango (ver FX_MAX_DEVIATION_PERCENT); se usa el último guardado.
  rejectedRate?: number
}

// Orden de preferencia: override manual (FX_USD_CLP_OVERRIDE), valor de hoy guardado,
// valor nuevo de mindicador.cl y, si la red falla, el último valor guardado.
export const resolveUsdClp = async (
  store: FxStore,
  options: {
    env?: NodeJS.ProcessEnv
    now?: Date
    fetchQuote?: () => Promise<FxQuote>
    // Variación máxima aceptada contra el último valor guardado, en porcentaje.
    maxDeviationPercent?: number
  } = {},
): Promise<ResolvedFx> => {
  const env = options.env ?? process.env
  const now = options.now ?? new Date()
  const fetchQuote = options.fetchQuote ?? (() => fetchUsdClp())
  const envMax = Number(env.FX_MAX_DEVIATION_PERCENT)
  const maxDeviation = options.maxDeviationPercent ?? (Number.isFinite(envMax) && envMax > 0 ? envMax : 8)

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
    // Control contra errores de precio: el dólar no se mueve más de unos pocos puntos de un día a otro. Un valor muy
    // distinto del último guardado es casi seguro un dato malo y pondría mal TODOS los precios en dólares: se descarta
    // y se sigue con el último guardado. Si el salto es real, fijarlo con FX_USD_CLP_OVERRIDE.
    const [previous] = await store.listIntcomexFxRates({}, { order: { date: "DESC" }, take: 1 })
    if (previous && previous.rate > 0 && (Math.abs(quote.rate - previous.rate) / previous.rate) * 100 > maxDeviation) {
      return { rate: previous.rate, date: previous.date, source: previous.source, stale: true, rejectedRate: quote.rate }
    }
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
