import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"

import { fetchUsdClp } from "./fx"

// Tarifa plana de despacho: USD convertido al tipo de cambio del dia mas un recargo fijo en CLP.
export type ShippingTariff = { usd: number; surchargeClp: number }

// Clave = campo type.code de la opcion de envio (ver scripts/setup-chile.ts).
export const SHIPPING_TARIFFS: Record<string, ShippingTariff> = {
  santiago: { usd: 3, surchargeClp: 1000 },
  regiones: { usd: 6, surchargeClp: 1000 },
}

// Redondea hacia arriba a la decena para no mostrar cobros con unidades sueltas.
export const shippingPriceClp = (tariff: ShippingTariff, usdClp: number): number => {
  if (!Number.isFinite(usdClp) || usdClp <= 0) {
    throw new Error(`Tipo de cambio invalido para el despacho: ${usdClp}`)
  }
  return Math.ceil((tariff.usd * usdClp + tariff.surchargeClp) / 10 - 1e-9) * 10
}

export type ShippingSyncResult = { rate: number; updated: { name: string; amount: number }[] }

// Recalcula el precio de las opciones de despacho con el tipo de cambio vigente.
export const syncShippingPrices = async (container: MedusaContainer): Promise<ShippingSyncResult> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { rate } = await fetchUsdClp()

  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "type.code"],
  })

  const input: { id: string; prices: { currency_code: string; amount: number }[] }[] = []
  const updated: ShippingSyncResult["updated"] = []
  for (const option of options as { id: string; name: string; type?: { code?: string } }[]) {
    const tariff = option.type?.code ? SHIPPING_TARIFFS[option.type.code] : undefined
    if (!tariff) {
      continue
    }
    const amount = shippingPriceClp(tariff, rate)
    input.push({ id: option.id, prices: [{ currency_code: "clp", amount }] })
    updated.push({ name: option.name, amount })
  }

  if (input.length) {
    await updateShippingOptionsWorkflow(container).run({ input })
  }
  return { rate, updated }
}
