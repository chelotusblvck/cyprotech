import { MedusaError } from "@medusajs/framework/utils"
// Tipo de cambio USD -> CLP. La fuente es mindicador.cl (valores del Banco Central de Chile).
const MINDICADOR_URL = "https://mindicador.cl/api/dolar"

export type FxQuote = { rate: number; date: string; source: string }

type FetchLike = (
  input: string,
  init?: { signal?: AbortSignal },
) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
}>

export const fetchUsdClp = async (
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
  timeoutMs = 10_000,
): Promise<FxQuote> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(MINDICADOR_URL, { signal: controller.signal })
    if (!response.ok) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `mindicador.cl respondió ${response.status}`)
    }
    const body = (await response.json()) as { serie?: { fecha?: string; valor?: number }[] }
    const latest = body.serie?.[0]
    if (!latest || typeof latest.valor !== "number" || latest.valor <= 0) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "mindicador.cl no entregó un valor de dólar válido")
    }
    return {
      rate: latest.valor,
      date: (latest.fecha ?? new Date().toISOString()).slice(0, 10),
      source: "mindicador.cl",
    }
  } finally {
    clearTimeout(timer)
  }
}
