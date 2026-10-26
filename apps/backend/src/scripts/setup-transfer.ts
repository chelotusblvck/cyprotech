import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createPromotionsWorkflow, updatePromotionsWorkflow, updateRegionsWorkflow } from "@medusajs/medusa/core-flows"

import {
  isBankConfigured,
  loadTransferConfig,
  TRANSFER_PROMO_CODE,
  TRANSFER_PROVIDER_ID,
} from "../lib/transfer/config"

// Habilita la transferencia directa en la region Chile y crea (o actualiza) la promocion del descuento.
// Solo habilita el medio de pago si estan cargados todos los datos bancarios (TRANSFER_BANK_*).
// Uso: npx medusa exec ./src/scripts/setup-transfer.ts
export default async function setupTransfer({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const config = loadTransferConfig()

  if (!isBankConfigured(config)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Faltan datos bancarios: define TRANSFER_BANK_HOLDER, _RUT, _NAME, _ACCOUNT_TYPE, _ACCOUNT_NUMBER y _EMAIL.",
    )
  }

  const {
    data: [region],
  } = await query.graph({
    entity: "region",
    fields: ["id", "payment_providers.id"],
    filters: { name: "Chile" },
  })
  if (!region) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "No existe la region Chile. Ejecuta primero setup-chile.")
  }
  const current = ((region as unknown as { payment_providers?: { id: string }[] }).payment_providers ?? []).map(
    (provider) => provider.id,
  )
  const providers = [...new Set([...current, TRANSFER_PROVIDER_ID])]
  await updateRegionsWorkflow(container).run({
    input: { selector: { id: region.id }, update: { payment_providers: providers } },
  })
  logger.info(`Medios de pago de Chile: ${providers.join(", ")}`)

  const {
    data: [existing],
  } = await query.graph({ entity: "promotion", fields: ["id", "application_method.id"], filters: { code: TRANSFER_PROMO_CODE } })
  if (existing) {
    await updatePromotionsWorkflow(container).run({
      input: {
        promotionsData: [
          {
            id: existing.id,
            status: "active",
            application_method: { value: config.discountPercent },
          },
        ],
      },
    })
    logger.info(`Promocion ${TRANSFER_PROMO_CODE} actualizada: ${config.discountPercent}%`)
    return
  }
  await createPromotionsWorkflow(container).run({
    input: {
      promotionsData: [
        {
          code: TRANSFER_PROMO_CODE,
          type: "standard",
          status: "active",
          is_automatic: false,
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "across",
            value: config.discountPercent,
            currency_code: "clp",
          },
        },
      ],
    },
  })
  logger.info(`Promocion ${TRANSFER_PROMO_CODE} creada: ${config.discountPercent}%`)
}
