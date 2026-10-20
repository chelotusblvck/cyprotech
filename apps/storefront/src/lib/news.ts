export type NewsPost = {
  id: string
  title: string
  slug: string
  summary: string
  body: string | null
  image_url: string | null
  image_alt: string | null
  image_credit: string | null
  category: string
  game: string | null
  source_name: string | null
  source_url: string | null
  featured: boolean
  published_at: string | null
}

export const NEWS_CATEGORIES: Record<string, { label: string; chip: string }> = {
  lanzamientos: { label: "Lanzamientos", chip: "border-neon-magenta/60 text-neon-magenta" },
  esports: { label: "Esports", chip: "border-neon-cyan/60 text-neon-cyan" },
  hardware: { label: "Hardware", chip: "border-vio-400/70 text-vio-300" },
  guias: { label: "Guías", chip: "border-neon-lime/60 text-neon-lime" },
  industria: { label: "Industria", chip: "border-white/40 text-white/80" },
}

const ART = new Set(["gta", "fifa", "halo", "valorant", "lol", "overwatch", "esports", "hardware", "guias"])

// Banner de la nota: el propio si lo tiene; si no, el arte del juego o de la categoría.
export const bannerFor = (post: Pick<NewsPost, "image_url" | "game" | "category">): string => {
  if (post.image_url) {
    return post.image_url
  }
  if (post.game && ART.has(post.game)) {
    return `/novedades/${post.game}.svg`
  }
  return ART.has(post.category) ? `/novedades/${post.category}.svg` : "/novedades/esports.svg"
}

export const formatNewsDate = (iso: string | null): string =>
  iso
    ? new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Santiago" }).format(new Date(iso))
    : ""

export const NEWS_PAGE_SIZE = 3
export const HOME_NEWS_PAGE_SIZE = 2
