import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  ProductStatus,
} from "@medusajs/framework/utils";
import { createProductsWorkflow } from "@medusajs/medusa/core-flows";

// Productos de muestra para validar el diseño. Se marcan con metadata.demo
// para poder borrarlos cuando entre el catálogo real de Intcomex.
// Precios en CLP con IVA incluido.
const DEMO: { title: string; category: string; price: number; description: string }[] = [
  { title: "Tarjeta de video GeForce RTX 4070 SUPER 12GB", category: "tarjetas-de-video", price: 749990, description: "GPU de alto rendimiento para juegos en 1440p con ray tracing y DLSS 3." },
  { title: "Procesador AMD Ryzen 7 7800X3D", category: "procesadores", price: 389990, description: "8 núcleos con 3D V-Cache, el procesador de referencia para gaming." },
  { title: "Monitor Gamer 27\" QHD 165Hz IPS", category: "monitores-gamer", price: 229990, description: "Panel IPS 1 ms con compatibilidad G-Sync y FreeSync." },
  { title: "Teclado Mecánico RGB Switch Red", category: "teclados", price: 69990, description: "Formato TKL, switches lineales y retroiluminación RGB por tecla." },
  { title: "Mouse Gamer Inalámbrico 26K DPI", category: "mouse", price: 49990, description: "Sensor óptico de 26.000 DPI, 60 g de peso y 70 horas de batería." },
  { title: "Audífonos Gamer 7.1 con Micrófono", category: "audifonos", price: 59990, description: "Sonido envolvente 7.1 virtual y micrófono con cancelación de ruido." },
  { title: "Router WiFi 6 AX3000 Doble Banda", category: "routers", price: 79990, description: "Cobertura estable y baja latencia para toda la casa." },
  { title: "Cámara IP 4MP Exterior con Visión Nocturna", category: "camaras-ip", price: 39990, description: "Resolución 4MP, protección IP67 y detección de movimiento." },
];

export default async function seedDemoGaming({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
  });
  const byHandle = new Map(categories.map((c: any) => [c.handle, c.id]));

  const {
    data: [store],
  } = await query.graph({ entity: "store", fields: ["default_sales_channel_id"] });
  const {
    data: [profile],
  } = await query.graph({ entity: "shipping_profile", fields: ["id"] });

  const slug = (t: string) =>
    t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  await createProductsWorkflow(container).run({
    input: {
      products: DEMO.map((p, i) => ({
        title: p.title,
        handle: slug(p.title),
        description: p.description,
        status: ProductStatus.PUBLISHED,
        shipping_profile_id: profile.id,
        category_ids: [byHandle.get(p.category) as string],
        sales_channels: [{ id: store.default_sales_channel_id as string }],
        metadata: { demo: true },
        options: [{ title: "Modelo", values: ["Único"] }],
        variants: [
          {
            title: "Único",
            sku: `DEMO-${i + 1}`,
            manage_inventory: false,
            options: { Modelo: "Único" },
            prices: [{ currency_code: "clp", amount: p.price }],
          },
        ],
      })),
    },
  });

  logger.info(`${DEMO.length} productos de muestra creados (metadata.demo = true).`);
}
