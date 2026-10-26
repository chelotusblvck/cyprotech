import type { MetadataRoute } from "next"

import { sdk } from "@lib/config"
import { listCategoryHandlesWithProducts } from "@lib/data/categories"
import { INFO_PAGES, isDraftPage } from "@lib/info-pages"
import { HIDDEN_CATEGORY_HANDLES } from "@lib/brand"
import { getBaseURL } from "@lib/util/env"

export const revalidate = 3600

const COUNTRY = process.env.NEXT_PUBLIC_DEFAULT_REGION || "cl"
const PAGE_SIZE = 100
const MAX_PRODUCTS = 5000

const listProductHandles = async (): Promise<string[]> => {
  const handles: string[] = []
  for (let offset = 0; offset < MAX_PRODUCTS; offset += PAGE_SIZE) {
    const { products, count } = await sdk.client.fetch<{
      products: { handle: string }[]
      count: number
    }>("/store/products", { query: { limit: PAGE_SIZE, offset, fields: "handle" } })
    handles.push(...products.map((product) => product.handle))
    if (offset + PAGE_SIZE >= count) {
      break
    }
  }
  return handles
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getBaseURL()
  const url = (path: string) => `${base}/${COUNTRY}${path}`

  const entries: MetadataRoute.Sitemap = [
    { url: url(""), changeFrequency: "daily", priority: 1 },
    { url: url("/store"), changeFrequency: "daily", priority: 0.9 },
    // Las paginas en borrador o con marcadores [COMPLETAR] no se publican en el sitemap.
    ...INFO_PAGES.filter((page) => !isDraftPage(page)).map((page) => ({
      url: url(`/${page.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  ]

  // Si el backend no responde durante el build, el sitemap sale solo con las paginas fijas.
  try {
    const categories = await listCategoryHandlesWithProducts()
    for (const handle of categories ?? []) {
      if (!HIDDEN_CATEGORY_HANDLES.includes(handle)) {
        entries.push({ url: url(`/categories/${handle}`), changeFrequency: "daily", priority: 0.7 })
      }
    }
    for (const handle of await listProductHandles()) {
      entries.push({ url: url(`/products/${handle}`), changeFrequency: "weekly", priority: 0.6 })
    }
  } catch {
    // sin catalogo
  }

  return entries
}
