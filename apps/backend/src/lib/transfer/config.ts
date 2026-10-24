// Pago por transferencia directa: proveedor propio (sin comision de pasarela) con descuento sobre los productos.

export const TRANSFER_PROVIDER_ID = "pp_transfer_transfer"
export const TRANSFER_PROMO_CODE = "TRANSFERENCIA"

export type TransferConfig = {
  // Descuento sobre los productos al pagar por transferencia, en porcentaje.
  discountPercent: number
  // Horas que se reserva el pedido esperando la transferencia antes de cancelarlo.
  deadlineHours: number
  bank: {
    holder: string
    rut: string
    bank: string
    accountType: string
    accountNumber: string
    email: string
  }
}

const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return value !== undefined && value !== "" && Number.isFinite(parsed) ? parsed : fallback
}

// El descuento nunca supera la comision que ahorramos con Flow: asi el margen no baja del piso.
export const capTransferDiscount = (discountPercent: number, paymentFeePercent: number): number =>
  Math.max(0, Math.min(discountPercent, paymentFeePercent))

export const loadTransferConfig = (env: NodeJS.ProcessEnv = process.env): TransferConfig => ({
  discountPercent: capTransferDiscount(
    num(env.TRANSFER_DISCOUNT_PERCENT, 2.5),
    num(env.PRICING_PAYMENT_FEE_PERCENT, 2.89),
  ),
  deadlineHours: num(env.TRANSFER_DEADLINE_HOURS, 48),
  bank: {
    holder: env.TRANSFER_BANK_HOLDER ?? "",
    rut: env.TRANSFER_BANK_RUT ?? "",
    bank: env.TRANSFER_BANK_NAME ?? "",
    accountType: env.TRANSFER_BANK_ACCOUNT_TYPE ?? "",
    accountNumber: env.TRANSFER_BANK_ACCOUNT_NUMBER ?? "",
    email: env.TRANSFER_BANK_EMAIL ?? "",
  },
})

// La transferencia solo se ofrece cuando los datos bancarios estan completos.
export const isBankConfigured = (config: TransferConfig): boolean =>
  Object.values(config.bank).every((value) => value.trim() !== "")

// Plazo limite para pagar, a partir de la fecha del pedido.
export const transferDeadline = (createdAt: Date | string, deadlineHours: number): Date =>
  new Date(new Date(createdAt).getTime() + deadlineHours * 3_600_000)
