import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getNews } from "@lib/data/news"
import { bannerFor, formatNewsDate, NEWS_CATEGORIES } from "@lib/news"
import InteractiveLink from "@modules/common/components/interactive-link"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const post = await getNews((await props.params).slug)
  if (!post) {
    return { title: "Nota no encontrada" }
  }
  return { title: post.title, description: post.summary }
}

export default async function NovedadPage(props: Props) {
  const post = await getNews((await props.params).slug)
  if (!post) {
    notFound()
  }
  const category = NEWS_CATEGORIES[post.category] ?? NEWS_CATEGORIES.industria
  const paragraphs = (post.body ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)

  return (
    <article>
      <div className="relative h-[320px] small:h-[460px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bannerFor(post)} alt={post.image_alt ?? ""} className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-vio-950 via-vio-950/40 to-transparent" aria-hidden="true" />
        <div className="content-container relative flex h-full flex-col justify-end pb-10">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <span className={`rounded-full border px-3 py-1 font-display text-xs font-semibold uppercase tracking-widest ${category.chip}`}>
              {category.label}
            </span>
            <time className="text-white/70" dateTime={post.published_at ?? undefined}>
              {formatNewsDate(post.published_at)}
            </time>
          </div>
          <h1 className="max-w-4xl font-display text-3xl font-bold uppercase leading-tight text-white small:text-5xl">{post.title}</h1>
        </div>
        {post.image_credit ? (
          <span className="absolute bottom-3 right-6 rounded bg-vio-950/70 px-2 py-0.5 text-[11px] text-white/70">{post.image_credit}</span>
        ) : null}
      </div>

      <div className="content-container py-12">
        <div className="max-w-3xl">
          <p className="text-xl leading-9 text-ui-fg-base">{post.summary}</p>
          {paragraphs.map((text, i) => (
            <p key={i} className="mt-6 text-lg leading-8 text-ui-fg-subtle">
              {text}
            </p>
          ))}
          {post.source_url ? (
            <p className="mt-10 border-t border-ui-border-base pt-6 text-sm text-ui-fg-muted">
              Fuente:{" "}
              <a href={post.source_url} target="_blank" rel="noopener noreferrer nofollow" className="text-vio-300 hover:text-neon-magenta">
                {post.source_name ?? post.source_url}
              </a>
            </p>
          ) : null}
          <div className="mt-10">
            <InteractiveLink href="/novedades">Volver a Novedades</InteractiveLink>
          </div>
        </div>
      </div>
    </article>
  )
}
