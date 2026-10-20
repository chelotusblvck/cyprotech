import { Metadata } from "next"

import { listNews } from "@lib/data/news"
import { NEWS_CATEGORIES, NEWS_PAGE_SIZE } from "@lib/news"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import NewsCard from "@modules/news/components/news-card"
import Pager from "@modules/news/components/pager"

export const metadata: Metadata = {
  title: "Novedades",
  description: "Lanzamientos, esports, hardware y guías para la comunidad gamer.",
}

export default async function NovedadesPage(props: {
  searchParams: Promise<{ page?: string; categoria?: string }>
}) {
  const { page: pageParam, categoria } = await props.searchParams
  const category = categoria && NEWS_CATEGORIES[categoria] ? categoria : undefined
  const page = Math.max(Number(pageParam) || 1, 1)

  const { posts, count } = await listNews({ limit: NEWS_PAGE_SIZE, offset: (page - 1) * NEWS_PAGE_SIZE, category })
  const pages = Math.max(Math.ceil(count / NEWS_PAGE_SIZE), 1)

  const hrefFor = (n: number) => {
    const params = new URLSearchParams()
    if (category) {
      params.set("categoria", category)
    }
    if (n > 1) {
      params.set("page", String(n))
    }
    const query = params.toString()
    return `/novedades${query ? `?${query}` : ""}`
  }

  const tab = (active: boolean) =>
    `rounded-full border px-4 py-1.5 font-display text-sm font-semibold uppercase tracking-wider transition-colors ${
      active ? "border-neon-magenta bg-vio-600 text-white" : "border-ui-border-strong text-ui-fg-subtle hover:border-neon-magenta"
    }`

  return (
    <div className="content-container py-14">
      <h1 className="font-display text-4xl font-bold uppercase tracking-tight small:text-6xl">
        Nove<span className="text-rgb">dades</span>
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ui-fg-subtle">
        Lanzamientos, torneos, hardware y guías para sacarle el máximo a tu setup.
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        <LocalizedClientLink href="/novedades" className={tab(!category)}>
          Todas
        </LocalizedClientLink>
        {Object.entries(NEWS_CATEGORIES).map(([key, value]) => (
          <LocalizedClientLink key={key} href={`/novedades?categoria=${key}`} className={tab(category === key)}>
            {value.label}
          </LocalizedClientLink>
        ))}
      </div>

      {posts.length ? (
        <>
          <div className="mt-10 flex flex-col gap-6">
            {posts.map((post, i) => (
              <NewsCard key={post.id} post={post} flip={((page - 1) * NEWS_PAGE_SIZE + i) % 2 === 1} priority={i === 0} />
            ))}
          </div>
          <Pager page={page} pages={pages} hrefFor={hrefFor} />
        </>
      ) : (
        <p className="mt-16 text-center text-ui-fg-subtle">Todavía no hay notas en esta categoría.</p>
      )}
    </div>
  )
}
