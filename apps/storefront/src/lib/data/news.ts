import { sdk } from "@lib/config"
import type { NewsPost } from "@lib/news"

type NewsList = { posts: NewsPost[]; count: number }

// La sección de novedades nunca debe tumbar una página: si el backend no responde, se muestra vacía.
export const listNews = async (query: { limit?: number; offset?: number; category?: string } = {}): Promise<NewsList> =>
  sdk.client
    .fetch<NewsList>("/store/news", { query, next: { revalidate: 60, tags: ["news"] } })
    .catch(() => ({ posts: [], count: 0 }))

export const getNews = async (slug: string): Promise<NewsPost | null> =>
  sdk.client
    .fetch<{ post: NewsPost }>(`/store/news/${encodeURIComponent(slug)}`, { next: { revalidate: 60, tags: ["news"] } })
    .then(({ post }) => post)
    .catch(() => null)
