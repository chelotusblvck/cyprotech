import { model } from "@medusajs/framework/utils"

// Nota de la sección Novedades: lanzamientos, esports, hardware y guías para la comunidad.
const NewsPost = model
  .define("news_post", {
    id: model.id({ prefix: "news" }).primaryKey(),
    title: model.text(),
    slug: model.text().unique(),
    // Resumen propio, de una o dos frases. No se copia el texto de la fuente.
    summary: model.text(),
    // Cuerpo de la nota en texto plano; los párrafos se separan con una línea en blanco.
    body: model.text().nullable(),
    // Banner a todo el ancho del sitio (16:7 recomendado). Vacío = arte de la categoría.
    image_url: model.text().nullable(),
    image_alt: model.text().nullable(),
    // Crédito de la imagen, p. ej. "Rockstar Games".
    image_credit: model.text().nullable(),
    // lanzamientos | esports | hardware | guias | industria
    category: model.text().default("industria"),
    // Juego al que se refiere, para el arte de respaldo: gta, fifa, halo, valorant, lol, overwatch...
    game: model.text().nullable(),
    source_name: model.text().nullable(),
    source_url: model.text().nullable(),
    // draft | published
    status: model.text().default("draft"),
    featured: model.boolean().default(false),
    published_at: model.dateTime().nullable(),
    // Cómo llegó: manual o rss. Las importadas siempre entran como borrador.
    origin: model.text().default("manual"),
  })
  .indexes([
    { on: ["status", "published_at"] },
    { on: ["category"] },
    { on: ["source_url"] },
  ])

export default NewsPost
