import { MedusaError } from "@medusajs/framework/utils"

export const CATEGORIES = ["lanzamientos", "esports", "hardware", "guias", "industria"] as const
export type NewsCategory = (typeof CATEGORIES)[number]

export const STATUSES = ["draft", "published"] as const

export type NewsInput = {
  title?: string
  summary?: string
  body?: string | null
  image_url?: string | null
  image_alt?: string | null
  image_credit?: string | null
  category?: string
  game?: string | null
  source_name?: string | null
  source_url?: string | null
  status?: string
  featured?: boolean
  published_at?: string | null
}

// "Lanzamiento: ¡Nueva expansión!" -> "lanzamiento-nueva-expansion"
export const slugify = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

// Devuelve un slug que no esté en uso agregando -2, -3... si hace falta.
export const uniqueSlug = (base: string, taken: Set<string>): string => {
  const root = slugify(base) || "nota"
  if (!taken.has(root)) {
    return root
  }
  let n = 2
  while (taken.has(`${root}-${n}`)) {
    n += 1
  }
  return `${root}-${n}`
}

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

// Las imágenes pueden ser una ruta de la tienda (/novedades/x.jpg) o una URL completa.
const isImageRef = (value: string) => value.startsWith("/") || isHttpUrl(value)

const clean = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

// Valida y normaliza lo que llega del admin. Con `partial` solo revisa los campos presentes.
export const normalizeNews = (input: NewsInput, partial = false) => {
  const out: Record<string, unknown> = {}
  const fail = (message: string) => {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
  }

  if (!partial || input.title !== undefined) {
    const title = input.title?.trim()
    if (!title) {
      fail("La nota necesita un título.")
    }
    out.title = title
  }
  if (!partial || input.summary !== undefined) {
    const summary = input.summary?.trim()
    if (!summary) {
      fail("La nota necesita un resumen.")
    }
    if (summary!.length > 400) {
      fail("El resumen es demasiado largo (máximo 400 caracteres).")
    }
    out.summary = summary
  }
  if (input.category !== undefined) {
    if (!(CATEGORIES as readonly string[]).includes(input.category)) {
      fail(`Categoría inválida. Usa: ${CATEGORIES.join(", ")}.`)
    }
    out.category = input.category
  }
  if (input.status !== undefined) {
    if (!(STATUSES as readonly string[]).includes(input.status)) {
      fail("Estado inválido. Usa draft o published.")
    }
    out.status = input.status
  }
  for (const key of ["body", "image_alt", "image_credit", "game", "source_name"] as const) {
    if (input[key] !== undefined) {
      out[key] = clean(input[key])
    }
  }
  if (input.image_url !== undefined) {
    const image = clean(input.image_url)
    if (image && !isImageRef(image)) {
      fail("La imagen debe ser una URL (http/https) o una ruta que empiece con /.")
    }
    out.image_url = image
  }
  if (input.source_url !== undefined) {
    const source = clean(input.source_url)
    if (source && !isHttpUrl(source)) {
      fail("El enlace a la fuente debe ser una URL http o https.")
    }
    out.source_url = source
  }
  if (input.featured !== undefined) {
    out.featured = Boolean(input.featured)
  }
  if (input.published_at !== undefined) {
    if (input.published_at === null || input.published_at === "") {
      out.published_at = null
    } else {
      const date = new Date(input.published_at)
      if (Number.isNaN(date.getTime())) {
        fail("La fecha de publicación no es válida.")
      }
      out.published_at = date
    }
  }
  return out
}
