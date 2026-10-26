import { TRANSFER_DISCOUNT_PERCENT } from "@lib/constants"
import { convertToLocale } from "@lib/util/money"

// Precio con el descuento por transferencia. Solo se muestra si la transferencia esta habilitada en el
// backend (setup-transfer) y se declara con NEXT_PUBLIC_TRANSFER_ENABLED=true.
const TransferDiscountNote = ({
  amount,
  currencyCode,
}: {
  amount?: number | null
  currencyCode?: string | null
}) => {
  if (process.env.NEXT_PUBLIC_TRANSFER_ENABLED !== "true" || !amount || !currencyCode) {
    return null
  }
  const discounted = Math.floor(amount * (1 - TRANSFER_DISCOUNT_PERCENT / 100))

  return (
    <p className="txt-compact-small text-ui-fg-subtle" data-testid="transfer-discount-note">
      Pagando por transferencia:{" "}
      <span className="font-semibold text-ui-fg-base">
        {convertToLocale({ amount: discounted, currency_code: currencyCode, maximumFractionDigits: 0 })}
      </span>{" "}
      ({TRANSFER_DISCOUNT_PERCENT}% de descuento)
    </p>
  )
}

export default TransferDiscountNote
