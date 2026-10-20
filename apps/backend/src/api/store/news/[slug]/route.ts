import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { NEWS_MODULE } from "../../../../modules/news"
import type NewsModuleService from "../../../../modules/news/service"
import { publicPost } from "../public"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: NewsModuleService = req.scope.resolve(NEWS_MODULE)
  const [post] = await service.listNewsPosts({
    slug: req.params.slug,
    status: "published",
    published_at: { $lte: new Date() },
  })
  if (!post) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "La nota no existe.")
  }
  res.setHeader("cache-control", "public, max-age=60, stale-while-revalidate=300")
  res.json({ post: publicPost(post) })
}
