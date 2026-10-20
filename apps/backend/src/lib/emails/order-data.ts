import { regionName } from "../chile"
import { toNumber } from "../numbers"
import type { Brand } from "./layout"
import type { OrderEmailData, TrackingInfo } from "./templates"

// Forma mínima del pedido de Medusa que usan los correos (ver ORDER_EMAIL_FIELDS).
export type OrderForEmail = {
  id: string
  display_id?: number | null
  email?: string | null
  created_at: string | Date
  item_total?: number | null
  shipping_total?: number | null
  discount_total?: number | null
  total: number
  items?: {
    title?: string | null
    product_title?: string | null
    variant_title?: string | null
    quantity: number
    unit_price: number
    total?: number | null
    thumbnail?: string | null
  }[]
  shipping_address?: {
    first_name?: string | null
    last_name?: string | null
    address_1?: string | null
    address_2?: string | null
    city?: string | null
    province?: string | null
    phone?: string | null
  } | null
  shipping_methods?: { name?: string | null }[]
  payment_collections?: { payments?: { provider_id?: string | null }[] }[]
}

// Campos que hay que pedir a la base para armar cualquier correo de pedido.
export const ORDER_EMAIL_FIELDS = [
  "id",
  "display_id",
  "email",
  "created_at",
  "item_total",
  "shipping_total",
  "discount_total",
  "total",
  "items.title",
  "items.product_title",
  "items.variant_title",
  "items.quantity",
  "items.unit_price",
  "items.total",
  "items.thumbnail",
  "shipping_address.*",
  "shipping_methods.name",
  "payment_collections.payments.provider_id",
]

const PAYMENT_LABELS: Record<string, string> = {
  pp_flow_flow: "Flow (tarjeta, débito o transferencia)",
  pp_system_default: "Pago manual",
}

// Plazo que Intcomex promete según la zona de despacho.
export const etaFor = (shippingMethod: string) => {
  const name = shippingMethod.toLowerCase()
  if (name.includes("santiago")) {
    return "2-4 días hábiles"
  }
  if (name.includes("regi")) {
    return "4-6 días hábiles"
  }
  return "los próximos días hábiles"
}

export const orderNumber = (order: Pick<OrderForEmail, "id" | "display_id">) =>
  order.display_id ? `CY${order.display_id}` : `CY${order.id.slice(-6).toUpperCase()}`

export const buildOrderEmailData = (
  order: OrderForEmail,
  options: {
    storefrontUrl: string
    brand?: Partial<Brand>
    countryCode?: string
    document?: OrderEmailData["document"]
    tracking?: TrackingInfo[]
  },
): OrderEmailData => {
  const address = order.shipping_address
  const customerName = [address?.first_name, address?.last_name].filter(Boolean).join(" ") || "cliente"
  const shippingMethod = order.shipping_methods?.[0]?.name ?? "Despacho"
  const providerId = order.payment_collections?.flatMap((collection) => collection.payments ?? [])[0]?.provider_id
  const items = (order.items ?? []).map((item) => ({
    title: item.product_title ?? item.title ?? "Producto",
    variant: item.variant_title && item.variant_title !== "Único" ? item.variant_title : null,
    quantity: toNumber(item.quantity),
    unitPrice: toNumber(item.unit_price),
    total: toNumber(item.total ?? toNumber(item.unit_price) * toNumber(item.quantity)),
    image: item.thumbnail ?? null,
  }))
  const subtotal = order.item_total != null ? toNumber(order.item_total) : items.reduce((sum, item) => sum + item.total, 0)

  return {
    brand: { storefrontUrl: options.storefrontUrl, ...options.brand },
    orderNumber: orderNumber(order),
    customerName,
    createdAt: new Date(order.created_at).toISOString(),
    items,
    subtotal,
    shippingTotal: toNumber(order.shipping_total),
    discountTotal: toNumber(order.discount_total),
    total: toNumber(order.total),
    address: {
      name: customerName,
      line1: address?.address_1 ?? "",
      line2: address?.address_2 ?? null,
      city: address?.city ?? null,
      region: regionName(address?.province) ?? null,
      phone: address?.phone ?? null,
    },
    shippingMethod,
    eta: etaFor(shippingMethod),
    paymentMethod: (providerId && PAYMENT_LABELS[providerId]) || "Pago en línea",
    orderUrl: `${options.storefrontUrl}/${options.countryCode ?? "cl"}/order/${order.id}/confirmed`,
    document: options.document ?? null,
    tracking: options.tracking,
  }
}
