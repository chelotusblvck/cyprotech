import type { ExecArgs } from "@medusajs/framework/types"

import { syncShippingPrices } from "../lib/pricing/shipping"

// Uso: npx medusa exec ./src/scripts/sync-shipping-prices.ts
export default async function syncShippingPricesScript({ container }: ExecArgs) {
  const { rate, updated } = await syncShippingPrices(container)
  console.log(`Tipo de cambio: ${rate}`)
  for (const item of updated) {
    console.log(`${item.name}: ${item.amount} CLP`)
  }
}
