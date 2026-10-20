import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

import { NEWS_MODULE } from "../../../../modules/news"
import { normalizeNews, type NewsInput } from "../../../../modules/news/logic"
import type NewsModuleService from "../../../../modules/news/service"

const find = async (service: NewsModuleService, id: string) => {
  const [post] = await service.listNewsPosts({ id })
  if (!post) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "La nota no existe.")
  }
  return post
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: NewsModuleService = req.scope.resolve(NEWS_MODULE)
  res.json({ post: await find(service, req.params.id) })
}

// Edita una nota. Al publicarla por primera vez se fija la fecha de publicación si no tenía.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: NewsModuleService = req.scope.resolve(NEWS_MODULE)
  const current = await find(service, req.params.id)
  const data = normalizeNews(req.body as NewsInput, true)

  if (data.status === "published" && !current.published_at && data.published_at === undefined) {
    data.published_at = new Date()
  }
  const post = await service.updateNewsPosts({ id: current.id, ...data } as never)
  res.json({ post })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: NewsModuleService = req.scope.resolve(NEWS_MODULE)
  const current = await find(service, req.params.id)
  await service.deleteNewsPosts(current.id)
  res.json({ id: current.id, deleted: true })
}
