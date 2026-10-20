import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { NEWS_MODULE } from "../modules/news"
import { feedsFromEnv, importFeeds } from "../modules/news/import"
import type NewsModuleService from "../modules/news/service"

// Importación manual de borradores desde NEWS_RSS_FEEDS (lo mismo que hace el job diario de las 06:00).
export default async function importNews({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const feeds = feedsFromEnv()
  if (!feeds.length) {
    logger.warn("NEWS_RSS_FEEDS está vacío: no hay fuentes que importar.")
    return
  }
  const service: NewsModuleService = container.resolve(NEWS_MODULE)
  const result = await importFeeds(service, feeds)
  logger.info(`Novedades: ${result.created} borradores nuevos, ${result.skipped} ya existían.`)
  for (const failure of result.errors) {
    logger.warn(`No se pudo leer ${failure.feed}: ${failure.error}`)
  }
}
