# Novedades y carrusel del hero

## Qué hay

- **Hero con carrusel** (8 diapositivas): la de marca, GTA, EA SPORTS FC, Halo, Valorant, League of Legends, Overwatch y juegos competitivos. Cambia cada 6 s, se pausa con el mouse o el foco, se desliza en el celular y respeta la preferencia de reducir animaciones. Cada diapositiva enlaza a la categoría que vende el hardware de ese juego.
- **Sección Novedades en la portada**: banners a todo el ancho del sitio, mitad imagen y mitad texto (alternando lados), 2 por página con paginación.
- **`/novedades`**: 3 notas por página, filtro por categoría (Lanzamientos, Esports, Hardware, Guías, Industria) y paginación. Cada nota tiene su página con el banner grande, el cuerpo y el enlace a la fuente.
- **Admin → Novedades**: crear, editar, publicar/despublicar y eliminar notas, subir el banner, e importar borradores por RSS.

## Imágenes: estado actual y cómo cambiarlas

Las fotos del hero y de los banners son de **Unsplash** (licencia Unsplash: uso comercial gratuito, sin obligación de atribuir). Se eligieron solo fotos de la biblioteca gratuita, no de Unsplash+ (que es de pago). Quedan en `apps/storefront/public/hero/` y `public/novedades/` (versiones de 2000 y 1400 px, de 130 a 980 KB).

| Uso | Foto (id de Unsplash) | Qué muestra |
| --- | --- | --- |
| Marca / Hardware | `1587202372775-e229f172b9d7` | Gabinete con ventiladores azules |
| GTA | `1551726742-e7fef3db157e` | Calle de ciudad de noche con neón |
| EA SPORTS FC | `1679391029864-d46f366a456b` | Estadio de fútbol de noche |
| Halo | `1688407832489-cc9db90773f5` | Nave espacial y planeta |
| Valorant | `1603481588273-2f908a9a7a1b` | Puesto gamer en tonos rojos |
| League of Legends | `1696710257827-75e2e5954059` | Puesto gamer morado y azul |
| Overwatch | `1542751371-adc38448a05e` | Jugador con audífonos en un evento |
| Esports | `1598550476439-6847785fcea6` | Escritorio con dos monitores y pósters de torneo |
| Guías | `1660855551740-4474188debdb` | PC con tarjeta de video |

Cualquiera se ve en `https://unsplash.com/photos/<id>`. No son arte oficial de los juegos (ni de sus editores): son fotos ambientales que acompañan el texto. No se pudo usar arte oficial porque ningún editor (Rockstar, EA, Microsoft, Riot, Blizzard) publica un kit con condiciones de uso claras para una tienda. Si consigues permiso por escrito, basta con reemplazar el archivo (misma ruta) o apuntar `image` a la nueva en `src/lib/hero-slides.ts`.

- **Hero:** `public/hero/<juego>.jpg`, ideal 1920 x 860, menos de 300 KB si es posible. Los textos y enlaces de cada diapositiva se editan en `src/lib/hero-slides.ts`.
- **Novedades:** en el admin, al editar la nota, sube el banner y completa el *crédito de la imagen*, que se muestra sobre la foto. Sin banner propio la nota usa la foto del juego o de la categoría.

## Fuentes y derechos de las notas

- Cada nota lleva **resumen propio** y enlace a la fuente. No se copian artículos.
- Las notas de ejemplo son guías propias y atemporales, sin fechas ni cifras de terceros.
- El pie de página aclara que los nombres de juegos y marcas pertenecen a sus propietarios.

## Importar por RSS

Define `NEWS_RSS_FEEDS` con direcciones separadas por coma (en Coolify, como variable del backend). Cada día a las 06:00 se traen las últimas entradas como **borradores sin imagen**; también se puede disparar desde el botón "Importar de RSS" o con `npx medusa exec ./src/scripts/import-news.ts`.

Nada se publica solo: hay que revisar cada borrador, reescribir el resumen con tus palabras, subir un banner con derechos y recién ahí publicarlo. Detecta el juego y la categoría por palabras clave y no repite notas ya importadas. Soporta RSS 2.0 y Atom, y fuentes que no usan UTF-8.

Fuentes que respondieron en las pruebas: `https://www.gamespot.com/feeds/news/`, `https://feeds.feedburner.com/ign/games-all` y `https://www.vandal.net/rss` (en español). Revisa los términos de uso de cada medio antes de usar su contenido.

## Cargar las notas de ejemplo

`npx medusa exec ./src/scripts/seed-news.ts` crea 8 guías publicadas (no repite si ya existen). En producción conviene correrlo una vez, o borrar las notas y escribir las propias.

## Producción

- Los banners subidos desde el admin se guardan en `/app/static`, que en el compose de Coolify es el volumen `staticfiles`. Hay que incluirlo en los respaldos.
- La URL pública de los archivos sale de `BACKEND_PUBLIC_URL`, así que debe estar definida antes de subir imágenes.
