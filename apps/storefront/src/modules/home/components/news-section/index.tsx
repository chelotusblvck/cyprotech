import { listNews } from "@lib/data/news"
import { HOME_NEWS_PAGE_SIZE } from "@lib/news"
import InteractiveLink from "@modules/common/components/interactive-link"
import NewsPager from "./pager"

// Portada: las últimas notas, 2 por página, cada una a todo el ancho del sitio.
export default async function NewsSection() {
  const { posts } = await listNews({ limit: HOME_NEWS_PAGE_SIZE * 4 })

  if (!posts.length) {
    return null
  }

  return (
    <section className="content-container py-16" aria-labelledby="novedades-titulo">
      <div className="mb-10 flex items-end justify-between gap-6">
        <h2 id="novedades-titulo" className="font-display text-3xl font-bold uppercase tracking-tight small:text-5xl">
          Nove<span className="text-rgb">dades</span>
        </h2>
        <InteractiveLink href="/novedades">Ver todas</InteractiveLink>
      </div>
      <NewsPager posts={posts} pageSize={HOME_NEWS_PAGE_SIZE} />
    </section>
  )
}
