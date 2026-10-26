import { MedusaError } from "@medusajs/framework/utils"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"

import { assertTransferDiscountOnlyWithTransfer } from "../../lib/transfer/discount-guard"
import { createIntcomexApi } from "../../modules/intcomex/client"
import { INTCOMEX_MODULE } from "../../modules/intcomex"
import { verifyCartLines } from "../../modules/intcomex/checkout/verify"
import type IntcomexModuleService from "../../modules/intcomex/service"
import { buildContext } from "../../modules/intcomex/sync/run"

// Antes de autorizar el pago se consulta a Intcomex (GetProduct) por cada producto del carrito:
// si no hay stock o el costo subió por sobre el precio publicado, se corta el checkout.
// Con el cliente simulado no hace nada, y se puede apagar con INTCOMEX_VERIFY_AT_CHECKOUT=false.
// Medusa admite un solo manejador del hook validate, asi que aqui tambien se valida el descuento por transferencia.
completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  await assertTransferDiscountOnlyWithTransfer(cart, container)

  if (process.env.INTCOMEX_VERIFY_AT_CHECKOUT === "false") {
    return
  }
  const api = createIntcomexApi()
  if (api.isMock) {
    return
  }

  const items = (cart.items ?? []) as {
    variant_sku?: string | null
    product_title?: string | null
    title?: string | null
    quantity: number
    unit_price: number
  }[]
  const skus = items.flatMap((item) => (item.variant_sku ? [item.variant_sku] : []))
  if (skus.length === 0) {
    return
  }

  const service: IntcomexModuleService = container.resolve(INTCOMEX_MODULE)
  const known = new Set((await service.listIntcomexProducts({ sku: skus })).map((row) => row.sku))
  const lines = items.flatMap((item) =>
    item.variant_sku && known.has(item.variant_sku)
      ? [
          {
            sku: item.variant_sku,
            title: item.product_title ?? item.title ?? undefined,
            quantity: item.quantity,
            unitPrice: item.unit_price,
          },
        ]
      : [],
  )
  if (lines.length === 0) {
    return
  }

  const { context } = await buildContext(service)
  const issues = await verifyCartLines(api, lines, context)
  if (issues.length > 0) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, issues.map((issue) => issue.message).join(" "))
  }
})
