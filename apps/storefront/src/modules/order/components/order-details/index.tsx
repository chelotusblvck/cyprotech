import { HttpTypes } from "@medusajs/types"
import { Text } from "@modules/common/components/ui"

type OrderDetailsProps = {
  order: HttpTypes.StoreOrder
  showStatus?: boolean
}

const OrderDetails = ({ order, showStatus }: OrderDetailsProps) => {
  const STATUS_ES: Record<string, string> = {
    not_fulfilled: "Pendiente de despacho",
    partially_fulfilled: "Despacho parcial",
    fulfilled: "Preparado",
    partially_shipped: "Enviado parcialmente",
    shipped: "Enviado",
    partially_delivered: "Entregado parcialmente",
    delivered: "Entregado",
    canceled: "Cancelado",
    not_paid: "Sin pagar",
    awaiting: "Esperando pago",
    authorized: "Autorizado",
    partially_captured: "Pagado parcialmente",
    captured: "Pagado",
    partially_refunded: "Reembolsado parcialmente",
    refunded: "Reembolsado",
    requires_action: "Requiere acción",
  }

  const formatStatus = (str: string) => {
    if (STATUS_ES[str]) {
      return STATUS_ES[str]
    }
    const formatted = str.split("_").join(" ")

    return formatted.slice(0, 1).toUpperCase() + formatted.slice(1)
  }

  return (
    <div>
      <Text>
        Enviamos el detalle de tu pedido a{" "}
        <span
          className="text-ui-fg-medium-plus font-semibold"
          data-testid="order-email"
        >
          {order.email}
        </span>
        .
      </Text>
      <Text className="mt-2">
        Fecha del pedido:{" "}
        <span data-testid="order-date">
          {new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeZone: "America/Santiago" }).format(
            new Date(order.created_at)
          )}
        </span>
      </Text>
      <Text className="mt-2 text-ui-fg-interactive">
        Número de pedido: <span data-testid="order-id">{order.display_id}</span>
      </Text>

      <div className="flex items-center text-compact-small gap-x-4 mt-4">
        {showStatus && (
          <>
            <Text>
              Estado del pedido:{" "}
              <span className="text-ui-fg-subtle " data-testid="order-status">
                {formatStatus(order.fulfillment_status)}
              </span>
            </Text>
            <Text>
              Estado del pago:{" "}
              <span
                className="text-ui-fg-subtle "
                sata-testid="order-payment-status"
              >
                {formatStatus(order.payment_status)}
              </span>
            </Text>
          </>
        )}
      </div>
    </div>
  )
}

export default OrderDetails
