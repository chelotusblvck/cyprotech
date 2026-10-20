import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import InteractiveLink from "@modules/common/components/interactive-link"
import ProductPreview from "@modules/products/components/product-preview"

export default async function FeaturedLatest({
  region,
}: {
  region: HttpTypes.StoreRegion
}) {
  const {
    response: { products },
  } = await listProducts({
    regionId: region.id,
    queryParams: { limit: 8, fields: "*variants.calculated_price" },
  })

  if (!products?.length) {
    return null
  }

  return (
    <section className="content-container pb-12">
      <div className="mb-10 flex items-end justify-between gap-6">
        <h2 className="font-display text-3xl font-bold uppercase tracking-tight small:text-5xl">
          Recién <span className="text-rgb">llegados</span>
        </h2>
        <InteractiveLink href="/store">Ver todo</InteractiveLink>
      </div>
      <ul className="grid grid-cols-2 gap-x-5 gap-y-12 small:grid-cols-4">
        {products.map((product) => (
          <li key={product.id}>
            <ProductPreview product={product} region={region} isFeatured />
          </li>
        ))}
      </ul>
    </section>
  )
}
