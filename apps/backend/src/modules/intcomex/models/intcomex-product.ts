import { model } from "@medusajs/framework/utils"

// Espejo local de un producto de Intcomex: costo, stock y a qué producto de la tienda corresponde.
const IntcomexProduct = model
  .define("intcomex_product", {
    id: model.id({ prefix: "icxp" }).primaryKey(),
    sku: model.text().unique(),
    mpn: model.text().nullable(),
    upc: model.text().nullable(),
    description: model.text(),
    brand: model.text().nullable(),
    category_path: model.text().nullable(),
    // Handle de nuestra categoría; null si ninguna regla lo reconoció.
    category_handle: model.text().nullable(),
    product_type: model.text().default("Physical"),
    // Costo neto (sin IVA) en la moneda de la cuenta.
    cost_net: model.float(),
    cost_currency: model.text().default("USD"),
    stock: model.number().default(0),
    on_sale: model.boolean().default(false),
    image_url: model.text().nullable(),
    // Producto y variante creados en Medusa.
    medusa_product_id: model.text().nullable(),
    medusa_variant_id: model.text().nullable(),
    inventory_item_id: model.text().nullable(),
    // Último precio público publicado (CLP con IVA).
    public_price: model.float().nullable(),
    // Si Intcomex dejó de listar el producto, se marca inactivo en vez de borrarlo.
    active: model.boolean().default(true),
    // "api" si lo cargó la sincronización con IWS; "manual" si se cargó desde la tienda web. La
    // sincronización no desactiva los manuales aunque Intcomex no los liste en su feed.
    source: model.text().default("api"),
    last_synced_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["medusa_product_id"] },
    { on: ["category_handle"] },
    { on: ["active", "stock"] },
  ])

export default IntcomexProduct
