import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { bannerFor, formatNewsDate, NEWS_CATEGORIES, type NewsPost } from "@lib/news"

// Banner a todo el ancho del sitio: mitad imagen, mitad texto. `flip` invierte los lados para dar ritmo.
export default function NewsCard({ post, flip = false, priority = false }: { post: NewsPost; flip?: boolean; priority?: boolean }) {
  const category = NEWS_CATEGORIES[post.category] ?? NEWS_CATEGORIES.industria

  return (
    <article className="glow-hover group relative grid overflow-hidden rounded-2xl border border-ui-border-base bg-ui-bg-base small:min-h-[360px] small:grid-cols-2">
      <div className={`relative min-h-[220px] overflow-hidden ${flip ? "small:order-2" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bannerFor(post)}
          alt={post.image_alt ?? ""}
          loading={priority ? "eager" : "lazy"}
          className="absolute inset-0 h-full w-full object-cover object-[72%_50%] transition-transform duration-700 group-hover:scale-105"
        />
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-t from-vio-950/70 via-transparent to-transparent ${
            flip ? "small:bg-gradient-to-l" : "small:bg-gradient-to-r"
          } small:from-transparent small:via-transparent small:to-vio-950/50`}
          aria-hidden="true"
        />
        {post.image_credit ? (
          <span className="absolute bottom-3 left-4 rounded bg-vio-950/70 px-2 py-0.5 text-[11px] text-white/70 backdrop-blur-sm">
            {post.image_credit}
          </span>
        ) : null}
      </div>

      <div className="relative flex flex-col justify-center gap-5 p-7 small:p-12">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className={`rounded-full border px-3 py-1 font-display text-xs font-semibold uppercase tracking-widest ${category.chip}`}>
            {category.label}
          </span>
          <time className="text-ui-fg-muted" dateTime={post.published_at ?? undefined}>
            {formatNewsDate(post.published_at)}
          </time>
        </div>
        <h3 className="font-display text-2xl font-bold uppercase leading-tight small:text-4xl">
          <LocalizedClientLink href={`/novedades/${post.slug}`} className="after:absolute after:inset-0">
            {post.title}
          </LocalizedClientLink>
        </h3>
        <p className="max-w-xl text-lg leading-8 text-ui-fg-subtle">{post.summary}</p>
        <span className="font-display text-sm font-semibold uppercase tracking-widest text-vio-300 transition-colors group-hover:text-neon-magenta">
          Leer nota &rarr;
        </span>
      </div>
    </article>
  )
}
