// Controles técnicos contra errores de precio.
//
// El precio de venta se calcula solo (costo de Intcomex x tipo de cambio x margen). Un dato malo, como un costo con un
// cero de menos o un tipo de cambio de otro orden de magnitud, publicaría un precio absurdo y un cliente podría comprarlo
// antes de que alguien lo vea. En vez de depender de una cláusula para anular esa venta, estos controles impiden que el
// error llegue a la tienda: un cambio de precio fuera de rango NO se aplica; queda retenido, se informa en la corrida de
// sincronización y se aplica a mano una vez revisado (acceptLargeChanges).

export type PriceGuardConfig = {
  // Baja máxima respecto del precio publicado, en porcentaje.
  maxDropPercent: number
  // Alza máxima respecto del precio publicado, en porcentaje.
  maxRisePercent: number
}

export type HeldPrice = {
  sku: string
  from: number
  to: number
  // Variación en porcentaje: negativa si baja, positiva si sube.
  changePercent: number
  reason: "drop" | "rise"
}

const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return value !== undefined && value !== "" && Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const loadPriceGuard = (env: NodeJS.ProcessEnv = process.env): PriceGuardConfig => ({
  maxDropPercent: num(env.PRICING_MAX_DROP_PERCENT, 30),
  maxRisePercent: num(env.PRICING_MAX_RISE_PERCENT, 60),
})

// null = el cambio está dentro de lo normal (o no hay precio publicado con que compararlo).
export const checkPriceChange = (
  sku: string,
  current: number | null,
  next: number,
  guard: PriceGuardConfig,
): HeldPrice | null => {
  if (current === null || !(current > 0)) {
    return null
  }
  const changePercent = Math.round(((next - current) / current) * 1000) / 10
  if (changePercent <= -guard.maxDropPercent) {
    return { sku, from: current, to: next, changePercent, reason: "drop" }
  }
  if (changePercent >= guard.maxRisePercent) {
    return { sku, from: current, to: next, changePercent, reason: "rise" }
  }
  return null
}

// "SKU1 12.990 -> 5.990 (-53,9 %)" para el estado de la corrida.
export const describeHeld = (held: HeldPrice[], max = 10): string =>
  held
    .slice(0, max)
    .map((h) => `${h.sku} ${h.from} -> ${h.to} (${h.changePercent > 0 ? "+" : ""}${String(h.changePercent).replace(".", ",")} %)`)
    .join("; ") + (held.length > max ? `; y ${held.length - max} más` : "")
