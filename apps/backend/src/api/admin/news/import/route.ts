import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { NEWS_MODULE } from "../../../../modules/news"
import { feedsFromEnv, importFeeds } from "../../../../modules/news/import"
import type NewsModuleService from "../../../../modules/news/service"

// Trae las novedades de las fuentes RSS configuradas (NEWS_RSS_FEEDS) y las deja como borrador.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const feeds = feedsFromEnv()
  if (!feeds.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "No hay fuentes RSS configuradas. Define NEWS_RSS_FEEDS con las direcciones separadas por coma.",
    )
  }
  const service: NewsModuleService = req.scope.resolve(NEWS_MODULE)
  res.json({ feeds: feeds.length, ...(await importFeeds(service, feeds)) })
}
