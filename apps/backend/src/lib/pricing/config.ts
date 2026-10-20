export type PricingConfig = {
  // Margen sobre el costo neto, en porcentaje (10 = 10%).
  marginPercent: number
  // IVA que se suma al precio neto de venta.
  ivaPercent: number
  // El precio público se redondea hacia arriba a un múltiplo de este valor (CLP).
  roundTo: number
  // Colchón sobre el tipo de cambio, en porcentaje, para cubrir variaciones entre cobro y compra.
  fxBufferPercent: number
}

const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return value !== undefined && value !== "" && Number.isFinite(parsed) ? parsed : fallback
}

export const loadPricingConfig = (env: NodeJS.ProcessEnv = process.env): PricingConfig => ({
  marginPercent: num(env.PRICING_MARGIN_PERCENT, 10),
  ivaPercent: num(env.PRICING_IVA_PERCENT, 19),
  roundTo: num(env.PRICING_ROUND_TO, 10),
  fxBufferPercent: num(env.PRICING_FX_BUFFER_PERCENT, 0),
})
