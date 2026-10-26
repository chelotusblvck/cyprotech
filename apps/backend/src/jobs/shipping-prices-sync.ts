import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { syncShippingPrices } from "../lib/pricing/shipping"

// Reaplica la tarifa de despacho (USD + recargo en CLP) con el tipo de cambio del dia.
export default async function shippingPricesSync(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const { rate, updated } = await syncShippingPrices(container)
    logger.info(`Despacho actualizado (USD ${rate}): ${updated.map((u) => `${u.name} ${u.amount}`).join(", ")}`)
  } catch (error) {
    // Si falla el tipo de cambio se conserva la tarifa vigente.
    logger.warn(`No se pudo actualizar el despacho: ${(error as Error).message}`)
  }
}

export const config = {
  name: "shipping-prices-sync",
  schedule: "45 3 * * *",
}
