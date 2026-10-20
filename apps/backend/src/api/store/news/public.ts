import type { InferTypeOf } from "@medusajs/framework/types"

import type NewsPost from "../../../modules/news/models/news-post"

type Post = InferTypeOf<typeof NewsPost>

// Solo lo que la tienda necesita mostrar: sin estado interno ni origen.
export const publicPost = (post: Post) => ({
  id: post.id,
  title: post.title,
  slug: post.slug,
  summary: post.summary,
  body: post.body,
  image_url: post.image_url,
  image_alt: post.image_alt,
  image_credit: post.image_credit,
  category: post.category,
  game: post.game,
  source_name: post.source_name,
  source_url: post.source_url,
  featured: post.featured,
  published_at: post.published_at,
})
