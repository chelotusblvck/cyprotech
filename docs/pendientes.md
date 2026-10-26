# Pendientes (guardado 2026-10-26)

Produccion corre `main` (commit ac4e066, merge del PR #1): transferencia directa, filtros Marca y Solo gaming,
despacho sincronizado, correo por Resend. Probado de punta a punta con pedidos de prueba #2 y #3.

## Para retomar primero: boleta electronica
- Cargar en Coolify (backend, variable por variable, NUNCA con Developer View): `BILLING_EMISOR_RUT` (78.531.895-1) y
  `BILLING_EMISOR_RAZON_SOCIAL` (Inversiones y Desarrollos Tecnologicos Garage360 SpA) si el emisor es esa empresa, mas
  `BILLING_EMISOR_GIRO`, `BILLING_EMISOR_ACTECO`, `BILLING_EMISOR_DIRECCION`, `BILLING_EMISOR_COMUNA`,
  `BILLING_EMISOR_SUCURSAL` (si aplica) y `BILLING_EMISOR_CORREO`. Datos del inicio de actividades del SII.
- API key de OpenFactura (`OPENFACTURA_API_KEY`, secreto; `OPENFACTURA_ENV` dev o prod). Sin ella la boleta queda simulada.
- Despues: Redeploy del backend y "Reintentar" en el pedido #3 del panel Control Cyprotech.

## Operacion y limpieza
- Antes de cada deploy: `docker builder prune -af` en el VPS (Coolify > Terminal > localhost). Disco al 46% tras la limpieza de hoy.
  NO usar `docker system prune -a --volumes` ni `docker volume prune`.
- Los pedidos #2 y #3 son de prueba (cliente Prueba E2E). El #2 se cancela solo a las 48 h; el #3 ya esta capturado.
- Dolar del panel con fecha 2026-10-22: revisar que el job de tipo de cambio actualice.
- Producto "HIK Monitor" sin marca: si es Hikvision, agregar la regla en `src/lib/catalog/brands.ts` y ejecutar
  `classify-products.js reindex`.
- Credenciales de Intcomex (API Key y Access Key): sigue en modo simulado.
- Cuando se compre cyprotech.cl: verificarlo en Resend (SPF y DKIM) y cambiar `MAIL_FROM` y `SUPPORT_EMAIL`.

## Datos en produccion (hacer juntos)
- Tarea 17: despublicar los 5 SKU `-B1`. Tarea 18: reimportar imagenes grandes. Tarea 19: limpiar titulos (AC000MSI29 con caracteres rotos).
- Comparador de precios: 3 de 73 productos con oferta; 2 estan bajo nuestro piso (G915 X TKL y mousepad G640). Aplicar precios (tarea 23) solo con tu aprobacion del CSV (apps/backend/comparacion-precios.csv, local).

## Plan completo
- docs/plan-mejoras-tienda.md. Faltan: categorias nuevas (26, 30, 31), bundles (32), carrusel de marcas (37), medios de pago con logos (38), regla de marcas en portada (40).
- Completar los `[COMPLETAR]` de las paginas informativas (CONTACT en apps/storefront/src/lib/info-pages.ts) y pasar lo legal por revision.

## Datos que debes entregar
- Correos y telefonos de contacto, horario, domicilio; kit de marca de Intcomex; lista de marcas gaming y emergentes a impulsar; datos del emisor de la boleta (arriba).

## Trampas conocidas
- Coolify: Developer View deja los secretos bloqueados sin Build time (el compose ya lo tolera). Solo se pasan al contenedor las variables declaradas en `infra/docker-compose.coolify.yml`.
- Medusa admite UN solo handler de `completeCartWorkflow.hooks.validate`. El build descarta carpetas llamadas `test`.
- Scripts en produccion son `.js`: `NODE_ENV=production npx medusa exec ./src/scripts/<nombre>.js`.
