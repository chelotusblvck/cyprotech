import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { NEWS_MODULE } from "../../../modules/news"
import { CATEGORIES } from "../../../modules/news/logic"
import type NewsModuleService from "../../../modules/news/service"
import { publicPost } from "./public"

// Notas publicadas, de la más nueva a la más antigua. ?limit, ?offset y ?category=...
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: NewsModuleService = req.scope.resolve(NEWS_MODULE)
  const { category, limit = "12", offset = "0" } = req.query as Record<string, string | undefined>
  const take = Math.min(Math.max(Number(limit) || 12, 1), 50)
  const skip = Math.max(Number(offset) || 0, 0)

  const [posts, count] = await service.listAndCountNewsPosts(
    {
      status: "published",
      published_at: { $lte: new Date() },
      ...(category && (CATEGORIES as readonly string[]).includes(category) ? { category } : {}),
    },
    { take, skip, order: { published_at: "DESC" } },
  )
  res.setHeader("cache-control", "public, max-age=60, stale-while-revalidate=300")
  res.json({ posts: posts.map(publicPost), count, limit: take, offset: skip })
}
