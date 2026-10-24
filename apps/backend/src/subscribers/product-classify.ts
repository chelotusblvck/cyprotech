import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { classifyProducts } from "../lib/catalog/classify"

// Marca canonica y etiqueta gamer para los productos nuevos (API, carga manual o admin).
export default async function productClassify({ event, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await classifyProducts(container, { productIds: [event.data.id] })
  } catch (error) {
    logger.warn(`No se pudo clasificar el producto ${event.data.id}: ${(error as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: "product.created",
}
