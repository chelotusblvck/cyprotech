import { priceFor, type SyncContext } from "../sync/plan"
import type { IntcomexApi } from "../client/types"
import { normalizeCurrency } from "../../../lib/pricing"

export type CartLine = {
  sku: string
  title?: string
  quantity: number
  // Precio unitario que verá pagar el cliente (CLP, IVA incluido).
  unitPrice: number
}

export type CartIssue = { sku: string; title?: string; reason: "stock" | "price" | "unavailable"; message: string }

// Consulta a Intcomex justo antes de cobrar (GetProduct), como pide su documentación.
// Es solo lectura: nunca modifica el carrito.
export const verifyCartLines = async (
  api: IntcomexApi,
  lines: CartLine[],
  context: SyncContext,
  options: { priceTolerancePercent?: number } = {},
): Promise<CartIssue[]> => {
  const tolerance = options.priceTolerancePercent ?? 2
  const issues: CartIssue[] = []

  for (const line of lines) {
    const product = await api.getProduct(line.sku)
    const name = line.title ?? line.sku

    if (!product) {
      issues.push({ sku: line.sku, title: line.title, reason: "unavailable", message: `${name} ya no está disponible.` })
      continue
    }

    const stock =
      product.InStock ?? (product.Locations ?? []).reduce((sum, location) => sum + (location.Stock ?? 0), 0)
    if (stock < line.quantity) {
      issues.push({
        sku: line.sku,
        title: line.title,
        reason: "stock",
        message: stock > 0 ? `${name}: solo quedan ${stock} unidades.` : `${name} se quedó sin stock.`,
      })
      continue
    }

    const cost = product.Price?.UnitPrice
    if (typeof cost === "number" && cost > 0) {
      const currency = normalizeCurrency(product.Price?.CurrencyId)
      if (currency === "CLP" || context.usdClp !== null) {
        const current = priceFor({ costNet: cost, currency }, context).publicPrice
        // Solo importa si el costo subió: ahí el precio publicado dejaría de cubrir el margen.
        if (current > line.unitPrice * (1 + tolerance / 100)) {
          issues.push({
            sku: line.sku,
            title: line.title,
            reason: "price",
            message: `${name} cambió de precio. Actualiza tu carrito para continuar.`,
          })
        }
      }
    }
  }

  return issues
}
