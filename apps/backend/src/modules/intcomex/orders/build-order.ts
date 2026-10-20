import { MedusaError } from "@medusajs/framework/utils"
import { regionName } from "../../../lib/chile"
import { normalizeCurrency, calculatePrice, type PricingConfig } from "../../../lib/pricing"
import type { IwsRequestOrder, IwsStoreOrderAddress } from "../client/types"

// Forma mínima de un pedido de Medusa (lo que pide el workflow en su query).
export type OrderForIntcomex = {
  id: string
  display_id?: number | null
  email?: string | null
  currency_code: string
  total?: number | null
  metadata?: Record<string, unknown> | null
  items?: {
    id: string
    title?: string | null
    quantity: number
    unit_price: number
    variant_sku?: string | null
  }[]
  shipping_address?: AddressInput | null
  billing_address?: AddressInput | null
  shipping_methods?: { name?: string | null; amount?: number | null }[]
  payment_collections?: { payments?: { data?: Record<string, unknown> | null }[] }[]
}

// Comisión real que cobró la pasarela por este pedido, sumando los pagos que la informan.
// Devuelve null si no hay pagos o alguno no trae la comisión (se estima con el porcentaje).
export const actualGatewayFee = (order: Pick<OrderForIntcomex, "payment_collections">): number | null => {
  const payments = (order.payment_collections ?? []).flatMap((collection) => collection.payments ?? [])
  if (payments.length === 0) {
    return null
  }
  let total = 0
  for (const payment of payments) {
    const fee = payment.data?.flowFee
    if (typeof fee !== "number" || !Number.isFinite(fee)) {
      return null
    }
    total += fee
  }
  return total
}

type AddressInput = {
  first_name?: string | null
  last_name?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country_code?: string | null
  phone?: string | null
  company?: string | null
}

// Fila de intcomex_product que necesita el snapshot.
export type CostRow = {
  sku: string
  cost_net: number
  cost_currency: string
}

export type LineSnapshot = {
  sku: string
  title: string | null
  quantity: number
  // Precio unitario pagado por el cliente, con IVA (CLP).
  unitPricePublic: number
  unitNetSale: number
  costNet: number
  costCurrency: string
  fxRate: number
  costNetClpPerUnit: number
  // Margen neto de la línea completa (antes de comisiones de pasarela, facturador y hosting).
  marginClp: number
  // De dónde sale el costo: catálogo local o respuesta de Intcomex.
  costSource: "catalog"
}

// Número que se envía como CustomerOrderNumber: sin caracteres especiales, único por pedido.
export const customerOrderNumber = (order: Pick<OrderForIntcomex, "id" | "display_id">) =>
  order.display_id ? `CY${order.display_id}` : `CY${order.id.replace(/[^a-zA-Z0-9]/g, "")}`

const toAddress = (
  address: AddressInput | null | undefined,
  email: string | null | undefined,
  rut: string | undefined,
): IwsStoreOrderAddress => ({
  FirstName: address?.first_name ?? undefined,
  LastName: address?.last_name ?? undefined,
  Email: email ?? undefined,
  DocumentId: rut,
  Cellphone: address?.phone ?? undefined,
  Address: address?.address_1 ?? undefined,
  SuiteNumber: address?.address_2 ?? undefined,
  // En Chile la comuna va en "ciudad" del formulario de despacho.
  City: address?.city ?? undefined,
  Neighborhood: address?.city ?? undefined,
  State: regionName(address?.province),
  StateId: address?.province ? address.province.toUpperCase() : undefined,
  PostalCode: address?.postal_code ?? undefined,
  CountryId: (address?.country_code ?? "cl").toUpperCase(),
})

export const buildIwsOrder = (
  order: OrderForIntcomex,
  options: { shipmentServiceType?: string; shipmentAmount?: number } = {},
): IwsRequestOrder => {
  const items = (order.items ?? []).filter((item) => item.variant_sku)
  if (items.length === 0) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `El pedido ${order.id} no tiene productos con SKU de Intcomex`)
  }
  if (!order.shipping_address?.address_1) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `El pedido ${order.id} no tiene dirección de despacho`)
  }

  const rut = typeof order.metadata?.rut === "string" ? order.metadata.rut : undefined
  const shipping = toAddress(order.shipping_address, order.email, rut)
  const billing = toAddress(order.billing_address ?? order.shipping_address, order.email, rut)

  return {
    CustomerOrderNumber: customerOrderNumber(order),
    StoreOrder: {
      StoreOrderNumber: customerOrderNumber(order),
      Customer: {
        FirstName: shipping.FirstName,
        LastName: shipping.LastName,
        Email: order.email ?? undefined,
        DocumentId: rut,
      },
      Billing: billing,
      Shipping: shipping,
      DeliveryType: order.shipping_methods?.[0]?.name ?? undefined,
      OrderTotal: order.total ?? undefined,
    },
    // Solo se informa el flete cuando Intcomex confirme el formato (ver docs/intcomex/NOTAS-API.md).
    Shipments: options.shipmentServiceType
      ? [{ ServiceType: options.shipmentServiceType, Amount: options.shipmentAmount ?? 0 }]
      : undefined,
    Items: items.map((item) => ({
      Sku: item.variant_sku as string,
      Quantity: item.quantity,
      StoreItemId: item.id,
    })),
  }
}

// Snapshot inmutable de costo, tipo de cambio y margen por línea. Es la base del ledger de socios:
// los reportes se calculan desde aquí y no desde los precios vigentes.
export const buildSnapshots = (
  order: OrderForIntcomex,
  rows: CostRow[],
  usdClp: number | null,
  pricing: PricingConfig,
): LineSnapshot[] => {
  const bySku = new Map(rows.map((row) => [row.sku, row]))
  return (order.items ?? []).flatMap((item) => {
    const row = item.variant_sku ? bySku.get(item.variant_sku) : undefined
    if (!row) {
      return []
    }
    const currency = normalizeCurrency(row.cost_currency)
    const cost = calculatePrice({ costNet: row.cost_net, currency }, usdClp, pricing)
    const unitNetSale = item.unit_price / (1 + pricing.ivaPercent / 100)
    return [
      {
        sku: row.sku,
        title: item.title ?? null,
        quantity: item.quantity,
        unitPricePublic: item.unit_price,
        unitNetSale: Math.round(unitNetSale * 100) / 100,
        costNet: row.cost_net,
        costCurrency: currency,
        fxRate: cost.fxRate,
        costNetClpPerUnit: cost.costNetClp,
        marginClp: Math.round((unitNetSale - cost.costNetClp) * item.quantity * 100) / 100,
        costSource: "catalog" as const,
      },
    ]
  })
}
