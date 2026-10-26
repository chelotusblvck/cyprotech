import { Container, Heading, Text } from "@modules/common/components/ui"

import { isStripeLike, isTransfer, paymentInfoMap } from "@lib/constants"
import Divider from "@modules/common/components/divider"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

type PaymentDetailsProps = {
  order: HttpTypes.StoreOrder
}

const PaymentDetails = ({ order }: PaymentDetailsProps) => {
  const payment = order.payment_collections?.[0].payments?.[0]
  // Una transferencia queda sin capturar hasta que se acredita el deposito.
  const awaitingTransfer =
    !!payment &&
    isTransfer(payment.provider_id) &&
    !(payment as { captured_at?: string | null }).captured_at

  return (
    <div>
      <Heading level="h2" className="flex flex-row text-3xl-regular my-6">
        Pago
      </Heading>
      <div>
        {payment && (
          <div className="flex items-start gap-x-1 w-full">
            <div className="flex flex-col w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Método de pago
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method"
              >
                {paymentInfoMap[payment.provider_id]?.title ??
                  payment.provider_id}
              </Text>
            </div>
            <div className="flex flex-col w-2/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Datos de pago
              </Text>
              <div className="flex gap-2 txt-medium text-ui-fg-subtle items-center">
                <Container className="flex items-center h-7 w-fit p-2 bg-ui-button-neutral-hover">
                  {paymentInfoMap[payment.provider_id]?.icon}
                </Container>
                <Text data-testid="payment-amount">
                  {awaitingTransfer
                    ? "Pendiente: revisa tu correo con los datos para transferir. Confirmamos el pedido al acreditarse el pago."
                    : isStripeLike(payment.provider_id) && payment.data?.card_last4
                    ? `**** **** **** ${payment.data.card_last4}`
                    : `${convertToLocale({
                        amount: payment.amount,
                        currency_code: order.currency_code,
                      })} pagados el ${new Intl.DateTimeFormat("es-CL", {
                        dateStyle: "long",
                        timeStyle: "short",
                        timeZone: "America/Santiago",
                      }).format(new Date(payment.created_at ?? ""))}`}
                </Text>
              </div>
            </div>
          </div>
        )}
      </div>

      <Divider className="mt-8" />
    </div>
  )
}

export default PaymentDetails
