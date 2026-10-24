import { MedusaError } from "@medusajs/framework/utils"
import type { PricingConfig } from "./config"

export type CostInput = {
  // Costo neto (sin IVA) tal como lo entrega Intcomex.
  costNet: number
  // Moneda del costo: "USD" o "CLP" (ya normalizada, ver normalizeCurrency).
  currency: "USD" | "CLP"
}

// Desglose completo de un precio. Se guarda como snapshot en cada línea de pedido
// para poder auditar el margen aunque después cambien el costo, el TC o la config.
export type PriceBreakdown = {
  costNet: number
  costCurrency: "USD" | "CLP"
  fxRate: number
  costNetClp: number
  marginPercent: number
  netSaleClp: number
  ivaPercent: number
  publicPriceRaw: number
  publicPrice: number
  // Diferencia de redondeo que se suma al precio público (CLP con IVA).
  roundingAdjustment: number
  // Margen neto real en CLP (neto de venta efectivo menos costo neto).
  marginAmountClp: number
  // Margen real sobre el costo, ya considerando el redondeo.
  effectiveMarginPercent: number
}

export const normalizeCurrency = (currencyId: string | null | undefined): "USD" | "CLP" => {
  const code = (currencyId ?? "").toUpperCase()
  if (code === "CL" || code === "CLP") {
    return "CLP"
  }
  // Intcomex entrega "US" para dólares; cualquier otro valor se trata como USD.
  return "USD"
}

// Recargo mínimo sobre el costo neto para que, descontada la comisión de la pasarela,
// quede al menos minNetMarginPercent. La comisión se calcula sobre el cobro con IVA.
export const floorMarginPercent = (config: PricingConfig): number => {
  const feeOverNetSale = (config.paymentFeePercent / 100) * (1 + config.ivaPercent / 100)
  return ((1 + config.minNetMarginPercent / 100) / (1 - feeOverNetSale) - 1) * 100
}

const round2 = (value: number) => Math.round(value * 100) / 100

// Precio neto de venta = costo neto x TC x (1 + margen), con el margen nunca bajo el piso.
// Precio público      = precio neto de venta x (1 + IVA), redondeado hacia arriba.
export const calculatePrice = (
  cost: CostInput,
  usdClp: number | null,
  config: PricingConfig,
): PriceBreakdown => {
  if (!Number.isFinite(cost.costNet) || cost.costNet < 0) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Costo inválido: ${cost.costNet}`)
  }

  let fxRate = 1
  if (cost.currency === "USD") {
    if (usdClp === null || !Number.isFinite(usdClp) || usdClp <= 0) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Falta el tipo de cambio USD/CLP para calcular el precio")
    }
    fxRate = usdClp * (1 + config.fxBufferPercent / 100)
  }

  const costNetClp = cost.costNet * fxRate
  const marginPercent = Math.max(config.marginPercent, floorMarginPercent(config))
  const netSaleClp = costNetClp * (1 + marginPercent / 100)
  const publicPriceRaw = netSaleClp * (1 + config.ivaPercent / 100)

  const step = config.roundTo > 0 ? config.roundTo : 1
  const publicPrice = Math.ceil(publicPriceRaw / step - 1e-9) * step
  const effectiveNetSale = publicPrice / (1 + config.ivaPercent / 100)
  const marginAmountClp = effectiveNetSale - costNetClp

  return {
    costNet: cost.costNet,
    costCurrency: cost.currency,
    fxRate,
    costNetClp: round2(costNetClp),
    marginPercent: round2(marginPercent),
    netSaleClp: round2(netSaleClp),
    ivaPercent: config.ivaPercent,
    publicPriceRaw: round2(publicPriceRaw),
    publicPrice,
    roundingAdjustment: round2(publicPrice - publicPriceRaw),
    marginAmountClp: round2(marginAmountClp),
    effectiveMarginPercent: costNetClp > 0 ? round2((marginAmountClp / costNetClp) * 100) : 0,
  }
}
