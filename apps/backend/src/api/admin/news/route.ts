import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { NEWS_MODULE } from "../../../modules/news"
import { normalizeNews, uniqueSlug, type NewsInput } from "../../../modules/news/logic"
import type NewsModuleService from "../../../modules/news/service"

// Todas las notas (borradores y publicadas). Filtros: ?status=draft|published y ?category=...
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: NewsModuleService = req.scope.resolve(NEWS_MODULE)
  const { status, category, limit = "100", offset = "0" } = req.query as Record<string, string | undefined>
  const take = Math.min(Math.max(Number(limit) || 100, 1), 300)
  const skip = Math.max(Number(offset) || 0, 0)

  const [posts, count] = await service.listAndCountNewsPosts(
    { ...(status ? { status } : {}), ...(category ? { category } : {}) },
    { take, skip, order: { created_at: "DESC" } },
  )
  res.json({ posts, count, limit: take, offset: skip })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: NewsModuleService = req.scope.resolve(NEWS_MODULE)
  const data = normalizeNews(req.body as NewsInput)

  const taken = new Set((await service.listNewsPosts({}, { select: ["slug"], take: 5000 })).map((post) => post.slug))
  const status = (data.status as string | undefined) ?? "draft"
  const post = await service.createNewsPosts({
    ...data,
    slug: uniqueSlug(data.title as string, taken),
    status,
    published_at: data.published_at ?? (status === "published" ? new Date() : null),
    origin: "manual",
  } as never)
  res.status(201).json({ post })
}
