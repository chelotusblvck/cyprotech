import { CreditCard } from "@medusajs/icons"
import Bancontact from "@modules/common/icons/bancontact"
import Ideal from "@modules/common/icons/ideal"
import PayPal from "@modules/common/icons/paypal"
import React from "react"

/* Map of payment provider_id to their title and icon. Add in any payment providers you want to use. */
export const paymentInfoMap: Record<
  string,
  { title: string; icon: React.JSX.Element }
> = {
  pp_stripe_stripe: {
    title: "Tarjeta de crédito",
    icon: <CreditCard />,
  },
  "pp_medusa-payments_default": {
    title: "Tarjeta de crédito",
    icon: <CreditCard />,
  },
  "pp_stripe-ideal_stripe": {
    title: "iDeal",
    icon: <Ideal />,
  },
  "pp_stripe-bancontact_stripe": {
    title: "Bancontact",
    icon: <Bancontact />,
  },
  pp_paypal_paypal: {
    title: "PayPal",
    icon: <PayPal />,
  },
  pp_flow_flow: {
    title: "Pago en línea con Flow",
    icon: <CreditCard />,
  },
  pp_transfer_transfer: {
    title: "Transferencia bancaria",
    icon: <CreditCard />,
  },
  pp_system_default: {
    title: "Pago manual",
    icon: <CreditCard />,
  },
  // Add more payment providers here
}

// This only checks if it is native stripe or medusa payments for card payments, it ignores the other stripe-based providers
export const isStripeLike = (providerId?: string) => {
  return (
    providerId?.startsWith("pp_stripe_") || providerId?.startsWith("pp_medusa-")
  )
}

export const isPaypal = (providerId?: string) => {
  return providerId?.startsWith("pp_paypal")
}
export const isFlow = (providerId?: string) => {
  return providerId?.startsWith("pp_flow")
}
export const isTransfer = (providerId?: string) => {
  return providerId === "pp_transfer_transfer"
}

// Codigo de la promocion que el backend crea con setup-transfer (descuento al pagar por transferencia).
export const TRANSFER_PROMO_CODE = "TRANSFERENCIA"
// Solo para mostrar; el descuento real lo define el backend (TRANSFER_DISCOUNT_PERCENT).
export const TRANSFER_DISCOUNT_PERCENT = Number(
  process.env.NEXT_PUBLIC_TRANSFER_DISCOUNT_PERCENT ?? "2.5"
)

export const isManual = (providerId?: string) => {
  return providerId?.startsWith("pp_system_default")
}

// Add currencies that don't need to be divided by 100
export const noDivisionCurrencies = [
  "krw",
  "jpy",
  "vnd",
  "clp",
  "pyg",
  "xaf",
  "xof",
  "bif",
  "djf",
  "gnf",
  "kmf",
  "mga",
  "rwf",
  "xpf",
  "htg",
  "vuv",
  "xag",
  "xdr",
  "xau",
]
