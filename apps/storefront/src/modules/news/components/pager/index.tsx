import LocalizedClientLink from "@modules/common/components/localized-client-link"

// Paginación por enlaces (sirve sin JavaScript y se puede compartir). `hrefFor` arma la dirección de cada página.
export default function Pager({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (page: number) => string }) {
  if (pages <= 1) {
    return null
  }
  const item = "flex h-10 min-w-10 items-center justify-center rounded-md border px-3 font-display text-sm font-semibold transition-colors"
  return (
    <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Paginación de novedades">
      {page > 1 ? (
        <LocalizedClientLink href={hrefFor(page - 1)} className={`${item} border-ui-border-strong hover:border-neon-magenta`} aria-label="Página anterior">
          &larr;
        </LocalizedClientLink>
      ) : null}
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <LocalizedClientLink
          key={n}
          href={hrefFor(n)}
          aria-current={n === page ? "page" : undefined}
          className={`${item} ${n === page ? "border-neon-magenta bg-vio-600 text-white" : "border-ui-border-strong hover:border-neon-magenta"}`}
        >
          {n}
        </LocalizedClientLink>
      ))}
      {page < pages ? (
        <LocalizedClientLink href={hrefFor(page + 1)} className={`${item} border-ui-border-strong hover:border-neon-magenta`} aria-label="Página siguiente">
          &rarr;
        </LocalizedClientLink>
      ) : null}
    </nav>
  )
}
