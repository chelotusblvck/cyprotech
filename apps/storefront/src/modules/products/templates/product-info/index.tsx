import { HttpTypes } from "@medusajs/types"
import { formatTitle } from "@lib/util/format-title"
import { Heading } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
}

// La descripcion importada trae viñetas como lineas que empiezan con "- " y parrafos sueltos.
const parseDescription = (text: string | null | undefined) => {
  const blocks: { type: "list" | "text"; lines: string[] }[] = []
  for (const raw of (text ?? "").split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) {
      continue
    }
    const bullet = /^[-•*]\s+(.*)$/.exec(line)
    const type = bullet ? "list" : "text"
    const last = blocks[blocks.length - 1]
    if (last && last.type === type && type === "list") {
      last.lines.push(bullet![1])
    } else {
      blocks.push({ type, lines: [bullet ? bullet[1] : line] })
    }
  }
  return blocks
}

const ProductInfo = ({ product }: ProductInfoProps) => {
  const blocks = parseDescription(product.description)

  return (
    <div id="product-info">
      <div className="flex flex-col gap-y-4 lg:max-w-[500px] mx-auto">
        {product.collection && (
          <LocalizedClientLink
            href={`/collections/${product.collection.handle}`}
            className="text-medium text-ui-fg-muted hover:text-ui-fg-subtle"
          >
            {product.collection.title}
          </LocalizedClientLink>
        )}
        <Heading
          level="h2"
          className="text-3xl leading-10 text-ui-fg-base"
          data-testid="product-title"
        >
          {formatTitle(product.title)}
        </Heading>

        <div
          className="flex flex-col gap-y-3 text-medium text-ui-fg-subtle"
          data-testid="product-description"
        >
          {blocks.map((block, index) =>
            block.type === "list" ? (
              <ul key={index} className="list-disc space-y-1 pl-5">
                {block.lines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            ) : (
              <p key={index}>{block.lines.join(" ")}</p>
            )
          )}
        </div>
      </div>
    </div>
  )
}

export default ProductInfo
