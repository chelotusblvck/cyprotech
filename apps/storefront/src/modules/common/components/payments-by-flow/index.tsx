import { TRANSFER_ENABLED } from "@lib/constants"
import { clx } from "@modules/common/components/ui"

// Aviso de los medios de pago: Flow y, si esta habilitada, la transferencia bancaria. Sin logo: hasta contar con el material oficial de Flow se usa
// solo texto y un candado generico (ver docs/plan-mejoras-tienda.md, tareas 28 y 38).
const PaymentsByFlow = ({ className }: { className?: string }) => (
  <p
    className={clx("flex items-center gap-2 txt-compact-small text-ui-fg-muted", className)}
    data-testid="payments-by-flow"
  >
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
    {TRANSFER_ENABLED ? "Pagos seguros con Flow o transferencia bancaria" : "Pagos seguros procesados por Flow"}
  </p>
)

export default PaymentsByFlow
