import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { HttpTypes } from "@medusajs/types"
import Product from "../product-preview"

const RELATED_LIMIT = 4

type RelatedProductsProps = {
  product: HttpTypes.StoreProduct
  countryCode: string
}

export default async function RelatedProducts({
  product,
  countryCode,
}: RelatedProductsProps) {
  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  // Relacionados = misma categoria. Sin categoria no hay criterio, asi que no se muestra la seccion
  // (antes salian productos cualquiera, p. ej. memorias RAM junto a una tarjeta de video).
  const categoryIds = (product.categories ?? []).map((category) => category.id)
  if (!categoryIds.length) {
    return null
  }

  const queryParams: HttpTypes.StoreProductListParams = {
    category_id: categoryIds,
    limit: RELATED_LIMIT + 1,
    is_giftcard: false,
  }
  if (region?.id) {
    queryParams.region_id = region.id
  }

  const products = await listProducts({
    queryParams,
    countryCode,
  }).then(({ response }) => {
    return response.products
      .filter((responseProduct) => responseProduct.id !== product.id)
      .slice(0, RELATED_LIMIT)
  })

  if (!products.length) {
    return null
  }

  return (
    <div className="product-page-constraint">
      <div className="flex flex-col items-center text-center mb-16">
        <span className="text-base-regular text-gray-600 mb-6">
          Productos relacionados
        </span>
        <p className="text-2xl-regular text-ui-fg-base max-w-lg">
          También te puede interesar.
        </p>
      </div>

      <ul className="grid grid-cols-2 small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8">
        {products.map((product) => (
          <li key={product.id}>
            <Product region={region} product={product} />
          </li>
        ))}
      </ul>
    </div>
  )
}
