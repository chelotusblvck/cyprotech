import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { NEWS_MODULE } from "../modules/news"
import { feedsFromEnv, importFeeds } from "../modules/news/import"
import type NewsModuleService from "../modules/news/service"

// Cada día a las 06:00: trae novedades de las fuentes RSS como borradores para revisar. No publica nada.
export default async function newsImport(container: MedusaContainer) {
  const feeds = feedsFromEnv()
  if (!feeds.length) {
    return
  }
  const service: NewsModuleService = container.resolve(NEWS_MODULE)
  const result = await importFeeds(service, feeds)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  logger.info(`Novedades: ${result.created} borradores nuevos, ${result.skipped} ya existían, ${result.errors.length} fuentes con error.`)
  for (const failure of result.errors) {
    logger.warn(`Novedades: no se pudo leer ${failure.feed}: ${failure.error}`)
  }
}

export const config = {
  name: "news-import",
  schedule: "0 6 * * *",
}
