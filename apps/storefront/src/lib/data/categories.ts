import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { HIDDEN_CATEGORY_HANDLES } from "@lib/brand"
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

// Handles de las categorias que tienen al menos un producto publicado, contando tambien las subcategorias
// (una categoria madre cuenta si alguna hija tiene productos). Devuelve null si algo falla, para no ocultar
// categorias por error: quien la use debe mostrar todo en ese caso.
export const listCategoryHandlesWithProducts = async (): Promise<Set<string> | null> => {
  try {
    const categoryCache = { ...(await getCacheOptions("categories")) }
    const productCache = { ...(await getCacheOptions("products")) }
    const { product_categories } = await sdk.client.fetch<{
      product_categories: Pick<HttpTypes.StoreProductCategory, "id" | "handle" | "parent_category_id">[]
    }>("/store/product-categories", {
      query: { fields: "id,handle,parent_category_id", limit: 200 },
      next: categoryCache,
      cache: "force-cache",
    })
    const counts = await Promise.all(
      product_categories.map((category) =>
        sdk.client
          .fetch<{ count: number }>("/store/products", {
            query: { category_id: [category.id], limit: 1, fields: "id" },
            next: productCache,
            cache: "force-cache",
          })
          .then((response) => response.count)
      )
    )

    const byId = new Map(product_categories.map((category) => [category.id, category]))
    const withProducts = new Set<string>()
    product_categories.forEach((category, index) => {
      if (counts[index] > 0) {
        let current: (typeof product_categories)[number] | undefined = category
        while (current && !withProducts.has(current.handle)) {
          withProducts.add(current.handle)
          current = current.parent_category_id ? byId.get(current.parent_category_id) : undefined
        }
      }
    })
    return withProducts
  } catch {
    return null
  }
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
    const [{ product_categories }, withProducts] = await Promise.all([
      sdk.client.fetch<{
        product_categories: Pick<HttpTypes.StoreProductCategory, "id" | "name" | "handle" | "parent_category_id" | "rank">[]
      }>("/store/product-categories", {
        query: { fields: "id,name,handle,parent_category_id,rank", limit: 200 },
        next,
        cache: "force-cache",
      }),
      listCategoryHandlesWithProducts(),
    ])
    const byRank = (a: { rank?: number | null }, b: { rank?: number | null }) => (a.rank ?? 0) - (b.rank ?? 0)
    return main.map((entry) => {
      const parent = product_categories.find((c) => c.handle === entry.handle)
      const children = parent
        ? product_categories
            .filter((c) => c.parent_category_id === parent.id)
            // Las subcategorias vacias o internas no se ofrecen en el menu; las principales siempre se muestran.
            .filter((c) => !HIDDEN_CATEGORY_HANDLES.includes(c.handle) && (withProducts?.has(c.handle) ?? true))
            .sort(byRank)
            .map((c) => ({ name: c.name, handle: c.handle }))
        : []
      return { ...entry, children }
    })
  } catch {
    return main.map((entry) => ({ ...entry, children: [] }))
  }
}
