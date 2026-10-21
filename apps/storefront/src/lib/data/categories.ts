import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const listCategories = async (query?: Record<string, unknown>) => {
  const next = {
    ...(await getCacheOptions("categories")),
  }

  const limit = query?.limit || 100

  return sdk.client
    .fetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
      "/store/product-categories",
      {
        query: {
          fields:
            "*category_children, *products, *parent_category, *parent_category.parent_category",
          limit,
          ...query,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories)
}

export const getCategoryByHandle = async (categoryHandle: string[]) => {
  const handle = `${categoryHandle.join("/")}`

  const next = {
    ...(await getCacheOptions("categories")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreProductCategoryListResponse>(
      `/store/product-categories`,
      {
        query: {
          fields: "*category_children, *products",
          handle,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories[0])
}

export type NavCategory = {
  name: string
  handle: string
  children: { name: string; handle: string }[]
}

// Árbol liviano para el menú de navegación (solo nombre y handle; sin productos). Respeta el orden
// y los nombres de `main`, y si el backend no responde devuelve las categorías sin subcategorías.
export const listNavCategories = async (main: { name: string; handle: string }[]): Promise<NavCategory[]> => {
  try {
    const next = { ...(await getCacheOptions("categories")) }
    const { product_categories } = await sdk.client.fetch<{
      product_categories: Pick<HttpTypes.StoreProductCategory, "id" | "name" | "handle" | "parent_category_id" | "rank">[]
    }>("/store/product-categories", {
      query: { fields: "id,name,handle,parent_category_id,rank", limit: 200 },
      next,
      cache: "force-cache",
    })
    const byRank = (a: { rank?: number | null }, b: { rank?: number | null }) => (a.rank ?? 0) - (b.rank ?? 0)
    return main.map((entry) => {
      const parent = product_categories.find((c) => c.handle === entry.handle)
      const children = parent
        ? product_categories
            .filter((c) => c.parent_category_id === parent.id)
            .sort(byRank)
            .map((c) => ({ name: c.name, handle: c.handle }))
        : []
      return { ...entry, children }
    })
  } catch {
    return main.map((entry) => ({ ...entry, children: [] }))
  }
}
