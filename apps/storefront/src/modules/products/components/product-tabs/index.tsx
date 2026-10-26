"use client"

import Back from "@modules/common/icons/back"
import FastDelivery from "@modules/common/icons/fast-delivery"
import Refresh from "@modules/common/icons/refresh"

import Accordion from "./accordion"
import { HttpTypes } from "@medusajs/types"

type ProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const ProductTabs = ({ product }: ProductTabsProps) => {
  const tabs = [
    {
      label: "Información del producto",
      component: <ProductInfoTab product={product} />,
    },
    {
      label: "Despacho y devoluciones",
      component: <ShippingInfoTab />,
    },
  ]

  return (
    <div className="w-full">
      <Accordion type="multiple">
        {tabs.map((tab, i) => (
          <Accordion.Item
            key={i}
            title={tab.label}
            headingSize="medium"
            value={tab.label}
          >
            {tab.component}
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  )
}

const metaText = (product: HttpTypes.StoreProduct, key: string) => {
  const value = product.metadata?.[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

// Solo se muestran los datos que existen; los guiones vacios no aportan nada al cliente.
const ProductInfoTab = ({ product }: ProductTabsProps) => {
  const variantWeight = product.variants?.find((variant) => variant.weight)?.weight
  const rows: [string, string | null][] = [
    ["Marca", metaText(product, "brand")],
    ["Número de parte", metaText(product, "mpn")],
    ["SKU", metaText(product, "sku")],
    ["Material", product.material ?? null],
    ["País de origen", product.origin_country ?? null],
    ["Tipo", product.type?.value ?? null],
    ["Peso", product.weight || variantWeight ? `${product.weight || variantWeight} g` : null],
    [
      "Dimensiones",
      product.length && product.width && product.height
        ? `${product.length} x ${product.width} x ${product.height}`
        : null,
    ],
  ]
  const visible = rows.filter((row): row is [string, string] => Boolean(row[1]))

  return (
    <div className="text-small-regular py-8">
      {visible.length ? (
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
          {visible.map(([label, value]) => (
            <div key={label}>
              <dt className="font-semibold">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>Sin información adicional por ahora.</p>
      )}
    </div>
  )
}

const ShippingInfoTab = () => {
  return (
    <div className="text-small-regular py-8">
      <div className="grid grid-cols-1 gap-y-8">
        <div className="flex items-start gap-x-2">
          <FastDelivery />
          <div>
            <span className="font-semibold">Despacho directo a tu domicilio</span>
            <p className="max-w-sm">
              Santiago: 2-4 días hábiles. Regiones: 4-6 días hábiles.
              Recibirás el número de seguimiento por correo.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-x-2">
          <Refresh />
          <div>
            <span className="font-semibold">Garantía</span>
            <p className="max-w-sm">
              Todos los productos cuentan con garantía del fabricante.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-x-2">
          <Back />
          <div>
            <span className="font-semibold">Cambios y devoluciones</span>
            <p className="max-w-sm">
              Si tu producto llega con algún problema, escríbenos y lo
              resolvemos.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductTabs
