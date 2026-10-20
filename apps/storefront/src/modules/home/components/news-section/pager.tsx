"use client"

import { useState } from "react"

import type { NewsPost } from "@lib/news"
import NewsCard from "@modules/news/components/news-card"

// Cambia de página sin recargar. Los puntos y las flechas son botones reales (teclado y lector de pantalla).
export default function NewsPager({ posts, pageSize }: { posts: NewsPost[]; pageSize: number }) {
  const pages = Math.ceil(posts.length / pageSize)
  const [page, setPage] = useState(0)
  const visible = posts.slice(page * pageSize, page * pageSize + pageSize)

  const control =
    "flex h-10 w-10 items-center justify-center rounded-md border border-ui-border-strong font-display text-lg transition-colors hover:border-neon-magenta disabled:opacity-30 disabled:hover:border-ui-border-strong"

  return (
    <div>
      <div className="flex flex-col gap-6" aria-live="polite">
        {visible.map((post, i) => (
          <NewsCard key={post.id} post={post} flip={(page * pageSize + i) % 2 === 1} priority={page === 0 && i === 0} />
        ))}
      </div>

      {pages > 1 ? (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button type="button" className={control} onClick={() => setPage((p) => p - 1)} disabled={page === 0} aria-label="Notas anteriores">
            &larr;
          </button>
          {Array.from({ length: pages }, (_, n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              aria-label={`Página ${n + 1}`}
              aria-current={n === page ? "true" : undefined}
              className={`h-2.5 rounded-full transition-all ${n === page ? "w-8 bg-neon-magenta shadow-[0_0_10px_#ff2bd6]" : "w-2.5 bg-ui-border-strong hover:bg-vio-400"}`}
            />
          ))}
          <button type="button" className={control} onClick={() => setPage((p) => p + 1)} disabled={page === pages - 1} aria-label="Notas siguientes">
            &rarr;
          </button>
        </div>
      ) : null}
    </div>
  )
}
