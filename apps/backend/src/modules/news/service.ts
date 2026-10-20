import { MedusaService } from "@medusajs/framework/utils"

import NewsPost from "./models/news-post"

class NewsModuleService extends MedusaService({
  NewsPost,
}) {}

export default NewsModuleService
