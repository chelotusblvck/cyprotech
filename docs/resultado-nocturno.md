# Resultado de la ejecucion nocturna (2026-10-22)

Rama local: `mejoras-tienda` (sale de main). No se hizo push, ni despliegue, ni se toco produccion ni la base de datos.
Un commit por tarea. Comparado con el estado anterior, el lint no tiene errores nuevos (el repo ya traia 19 lineas de errores/avisos previos en cart.ts, language-select y otros; no se tocaron).

## Hecho

| Tarea | Commit | Que cambio |
|---|---|---|
| 1 Menu movil transparente | Menu movil: fondo solido | La clase `bg-ui-bg-base/95` no generaba CSS porque las variables son rgba(); ahora fondo solido y oscurecido detras del panel |
| 2 Scroll horizontal | Evitar el scroll horizontal | `overflow-x: clip` en body (ademas de arreglar la cabecera, que era la causa probable) |
| 3 Cabecera movil | Cabecera movil: carrito compacto | Icono de carrito con contador en movil, menos espacio entre botones, logo mas chico |
| 4 Carrusel | Carrusel de inicio | Los puntos ya no tapan los botones en movil (mas alto y separados) |
| 5 Imagen de ficha | Ficha: la imagen se ve completa | `object-contain` sobre fondo blanco |
| 6 Descripcion | Ficha: viñetas reales | Se quita el guion suelto; pestana de informacion muestra marca, numero de parte y SKU, y oculta filas vacias |
| 7 Relacionados | Productos relacionados | Solo de la misma categoria, maximo 4; sin categoria no se muestra |
| 8 Listado movil | Listado en movil | Filtros y orden tras el boton "Filtrar y ordenar" |
| 9 Filtro Modelo | Filtros: ocultar grupos con una sola opcion | Ya no sale "Modelo (Unico)" |
| 10 Footer interno | Categorias: ocultar internas y vacias | `productos-con-detalles` ya no se enlaza (lista en `lib/brand.ts`) |
| 11 Categorias vacias | (mismo commit) | Menu y footer solo muestran categorias con productos; la madre lista tambien los de sus subcategorias; pagina vacia con mensaje y enlace a la tienda |
| 12 Titulos | Titulos de producto | `lib/util/format-title.ts` pasa palabras en MAYUSCULAS a formato normal, sin tocar siglas ni codigos (lista de siglas editable) |
| 13 Novedades | Novedades | Se oculta del menu mientras no haya notas; mensaje vacio mejor |
| 14 Paginas | Paginas informativas en borrador | Como comprar, cambios y devoluciones, contacto, preguntas frecuentes, terminos y privacidad, en `lib/info-pages.ts`; columna "Ayuda" en el footer |
| 15 SEO | SEO: sitemap y robots reales | `app/sitemap.ts`, `app/robots.ts`; el middleware redirigia ambos a la pagina de error y ahora los excluye; titulos y descripciones utiles en producto y categoria |
| 16 Busqueda | (cubierta por la 25) | El buscador usa el mismo servicio `/store/search` que el listado |
| 25 Buscador | Buscador: precio, miniatura... | El panel ya existia. Ahora: precio por resultado, vista previa grande al pasar el mouse (escritorio), "Ver todos los resultados", Enter lleva a /store con la busqueda, textos en espanol |
| 27 "Ver todo" | Menus: Ver todo | Ahora dice "Ver toda la tienda" y abre /store sin filtros (menu de escritorio y movil) |
| 28 Flow | Indicar que los pagos los procesa Flow | Aviso con candado (sin logo) en ficha, footer y checkout; el checkout ya no promete "tarjetas, debito y transferencia" |

## Saltado o pendiente (decision tuya)

- Tareas 17 a 24 y 26 a 40: no estaban autorizadas esta noche (datos, precios, categorias nuevas, marcas, bundles, transferencia).
- **Paginas legales:** los textos son borradores propios con marcadores `[COMPLETAR]` (correos, telefono, razon social, RUT, domicilio, horario, plazos de retracto y reembolso). Mientras tengan marcadores o digan "BORRADOR" quedan `noindex` y fuera del sitemap. Revisa lo legal con un abogado. Los datos de contacto se editan en un solo lugar: `CONTACT` en `apps/storefront/src/lib/info-pages.ts`.
- **Logo de Flow:** no hay material oficial en el repo, por eso se uso texto y un candado generico.
- **Titulos cortados** ("Beast Blac"): vienen cortados desde Intcomex, no se puede arreglar en el sitio; se resuelve al limpiar datos (tarea 19).
- **Fotos borrosas:** el origen es de 200x150; `object-contain` mejora el encuadre pero no la nitidez. Se arregla reimportando imagenes grandes (tarea 18).
- Categoria madre: incluye subcategorias de un solo nivel; si luego hay mas niveles hay que ajustar `modules/categories/templates/index.tsx`.

## Como probarlo localmente

```bash
cd apps/storefront
pnpm run dev          # http://localhost:8000
```

Necesitas el backend levantado (`pnpm run backend:dev`) y un `.env` con la clave publicable. Revisa en este orden:

1. Movil (DevTools, 390 px): menu (fondo solido), cabecera, carrusel de inicio, sin scroll horizontal.
2. Lupa: escribe un producto, pasa el mouse por los resultados (miniatura), presiona Enter.
3. `/cl/store` en movil: boton "Filtrar y ordenar".
4. Una ficha de producto: imagen completa, viñetas, relacionados de la misma categoria, aviso de Flow.
5. Footer: columna Ayuda, sin "Productos con detalles", aviso de medios de pago.
6. `/cl/contacto`, `/cl/como-comprar`, etc., `/sitemap.xml` y `/robots.txt`.

Para ver la rama completa: `git log --oneline main..mejoras-tienda`. Para integrarla cuando la revises: `git checkout main && git merge mejoras-tienda` (y desplegar tu mismo desde Coolify).

## Verificacion

- `pnpm run build` en apps/storefront: termino sin errores (exit 0). `/robots.txt`, `/sitemap.xml` y `/[countryCode]/[page]` aparecen en la salida.
- Importante: `next.config.js` tiene `ignoreBuildErrors` e `ignoreDuringBuilds`, asi que el build no valida tipos ni lint. Por eso cada commit se comparo contra el lint previo (sin errores nuevos). El chequeo de tipos del repo ya trae ~200 errores de entorno (TS2786 por versiones de @types/react) y no se tomo como referencia.
- No se probo en navegador: Chrome no estaba conectado durante la noche. Lo visual (menu movil, miniatura del buscador, carrusel) hay que mirarlo.
