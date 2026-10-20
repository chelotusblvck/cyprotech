# Novedades y carrusel del hero

## Qué hay

- **Hero con carrusel** (8 diapositivas): la de marca, GTA, EA SPORTS FC, Halo, Valorant, League of Legends, Overwatch y juegos competitivos. Cambia cada 6 s, se pausa con el mouse o el foco, se desliza en el celular y respeta la preferencia de reducir animaciones. Cada diapositiva enlaza a la categoría que vende el hardware de ese juego.
- **Sección Novedades en la portada**: banners a todo el ancho del sitio, mitad imagen y mitad texto (alternando lados), 2 por página con paginación.
- **`/novedades`**: 3 notas por página, filtro por categoría (Lanzamientos, Esports, Hardware, Guías, Industria) y paginación. Cada nota tiene su página con el banner grande, el cuerpo y el enlace a la fuente.
- **Admin → Novedades**: crear, editar, publicar/despublicar y eliminar notas, subir el banner, e importar borradores por RSS.

## Imágenes: estado actual y cómo cambiarlas

Hoy todo el arte es **original y sin marcas** (ilustraciones vectoriales con la ambientación de cada juego), en `apps/storefront/public/hero/` y `public/novedades/`. No se usó arte de Rockstar, EA, Microsoft, Riot ni Blizzard porque no pudimos confirmar que sus kits de prensa permitan usarlo en una tienda:

- Riot publica solo logos en su página de prensa, sin condiciones de uso visibles.
- Para Rockstar, EA, Halo y Blizzard no hay kit público con términos claros.
- El arte de comunidades de Figma tampoco da derechos sobre el arte original.

**Si obtienes permiso** (los equipos de prensa responden: p. ej. media@riotgames.com), cambia el arte así:

- **Hero:** reemplaza el archivo en `public/hero/<juego>.svg` o apunta `image` en `src/lib/hero-slides.ts` a la nueva ruta (ideal 1920 x 860, JPG o WebP de menos de 300 KB). Los textos y enlaces de cada diapositiva se editan en ese mismo archivo.
- **Novedades:** en el admin, al editar la nota, sube el banner y completa el *crédito de la imagen*, que se muestra sobre la foto.

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
