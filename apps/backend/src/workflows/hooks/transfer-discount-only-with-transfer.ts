import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"

import { TRANSFER_PROMO_CODE, TRANSFER_PROVIDER_ID } from "../../lib/transfer/config"

// El descuento por transferencia reemplaza la comision de Flow que no se paga: si el cliente lo escribe
// a mano y paga con otro medio, el margen quedaria bajo el piso. La tienda lo aplica al elegir
// transferencia; aqui se impide completar la compra con ese codigo y otro medio de pago.
completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  const promotions = ((cart as { promotions?: { code?: string | null }[] }).promotions ?? []).map((promotion) =>
    (promotion.code ?? "").toUpperCase(),
  )
  if (!promotions.includes(TRANSFER_PROMO_CODE)) {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [row],
  } = await query.graph({
    entity: "cart",
    fields: ["id", "payment_collection.payment_sessions.provider_id"],
    filters: { id: (cart as { id: string }).id },
  })
  const sessions = (row as unknown as { payment_collection?: { payment_sessions?: { provider_id?: string }[] } })
    ?.payment_collection?.payment_sessions ?? []
  if (!sessions.some((session) => session.provider_id === TRANSFER_PROVIDER_ID)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "El descuento por transferencia solo vale al pagar por transferencia. Quita el codigo o elige transferencia.",
    )
  }
})
