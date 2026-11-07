# Pendientes (actualizado 2026-11-07, noche)

## Estado al cierre del 2026-11-07
- Despliegue con imagenes de GitHub Actions (GHCR): el VPS ya no compila. Deploy del backend ~2 min, de la tienda ~15 s.
- Tienda en `cyprotech.cl` (app `cyprotech-storefront`, Docker Image) y backend `cyprotech-core` (compose con `image:`).
- Correo por SMTP de Resend funcionando (clave nueva cargada). Invitaciones al admin por correo (suscriptor `staff-invite-email`).
- Boletas electronicas automaticas en produccion: servicio `garage360-dte` en `dte.garage360.cl` con ambiente `produccion`,
  resolucion 99 del 2014-10-21, CAF de 100 folios. `BILLING_AUTO_ISSUE=true`. Verificado con el pedido real #4
  (transferencia, $9.029): al capturar el pago salio la Boleta N 1, con PDF y correo de confirmacion.
- Cuenta `marcelo@cyprotech.cl` creada en el admin. Dolar del panel al dia.

## Para finalizar manana (2026-11-08)

### Boletas y SII
1. Revisar que la Boleta N 1 pase de "Pendiente" a "Aceptado" en Control Cyprotech (la consulta corre cada 10 min).
2. Respaldo del volumen `/data` de `garage360-dte` (folios y boletas firmadas, se conservan 6 anos): tarea programada en
   Coolify o cron en el VPS con `node /app/src/respaldo.ts /data/respaldos 14`, mas copia FUERA del VPS. Guardar aparte,
   cifrado, el certificado, su clave y el CAF de produccion (no se recupera si se pierde).
3. Contador: confirmar que Garage360 tiene inscrita la actividad de comercio (por ejemplo 479100). Hoy solo tiene giros de software.
4. Pedidos de prueba #1, #2 y #3: NO pulsar "Reintentar" en el #3 (emitiria una boleta real). Limpiarlos antes de promocionar.
5. Anulaciones: la nota de credito se emite a mano en el portal del SII; falta un boton en el dashboard para confirmar el folio
   (hoy solo existe `POST /admin/billing/documents/:id/credit-note/confirm`).
6. Boletas sobre 135 UF: enviar `medioPago` (Flow = 2, transferencia = 3) desde la tienda y definir `DTE_VALOR_UF` en el servicio.

### Cuentas y seguridad
7. Invitar a `leonardo@cyprotech.cl` (Settings > Users > Invite) y entregarle el enlace; debe abrirlo en ventana de incognito.
8. Correo de "olvide mi clave" (suscriptor de `auth.password_reset`, mismo patron que `staff-invite`). Con eso rotar la clave de
   Marcelo, que quedo visible en una captura.
9. Probar que `ALERT_EMAIL` (alertas@cyprotech.cl) recibe las alertas internas.
10. Revisar los logs del backend tras cualquier cambio de SMTP: buscar "No se pudo enviar el correo".

### Infraestructura
11. Limite de memoria de 400 MB en la app `cyprotech-storefront`.
12. Deploy automatico: token de la API de Coolify; secreto `COOLIFY_TOKEN` y variables `COOLIFY_URL`,
    `COOLIFY_BACKEND_UUID`, `COOLIFY_STOREFRONT_UUID` en GitHub (los workflows ya los usan si existen).
13. Borrar la app vieja `cyprotech-store` (detenida, solo para rollback) cuando se confirme estabilidad.
14. `cypro.garage360.cl` y `cypro-api.garage360.cl` dan 503: retirarlos. Antes, confirmar que se corrio
    `rewrite-media-host.js https://cypro-api.garage360.cl https://cyprotech.cl` (dry-run primero) y que `www` redirige al apex.
15. Respaldo diario de Postgres: existe el cron de las 03:30 en el VPS; falta la copia fuera del VPS.

### Negocio y tienda
16. Intcomex en modo simulado: cargar `INTCOMEX_API_KEY` e `INTCOMEX_ACCESS_KEY` (secretas, en Coolify) y pedir que registren la
    IP `216.185.51.16`. Luego lanzar las sincronizaciones (catalogo, precios, inventario) desde Control Cyprotech.
17. Flow a produccion: `FLOW_ENV=production` con claves reales, probar un pago completo, `enable-flow.js`; revisar el pie
    "Pagos procesados por Flow".
18. Paginas informativas con `[COMPLETAR]` (`apps/storefront/src/lib/info-pages.ts`) y revision legal (terminos, devoluciones, garantia).
19. Catalogo: despublicar los 5 SKU `-B1` (tarea 17), reimportar imagenes grandes (18), titulo roto de AC000MSI29 (19), marca de
    "HIK Monitor". Comparador de precios: aplicar solo con aprobacion del CSV.
20. Plan de mejoras (`docs/plan-mejoras-tienda.md`): categorias nuevas, bundles, carrusel de marcas, logos de medios de pago, marcas en portada.

## Trampas conocidas
- Coolify: no usar "Developer View" para editar variables. Chrome autocompleta los campos Comment y Value del dialogo: borrarlos.
- Coolify, compose: no hay "Restart"; "Redeploy" aplica las variables nuevas ("Changes pending" = aun no aplicado).
- Coolify: al quitar un dominio o detener una app, desmarcar "delete DNS record" y "Docker cleanup"; detener pide doble confirmacion.
- Coolify > Persistent Storage > Files muestra el contenido de los archivos montados, incluida la clave privada del firmante.
- Toda `NEXT_PUBLIC_*` de la tienda se incrusta al compilar: debe estar como ARG en el Dockerfile, en `build-args` del workflow
  y como variable del repositorio en GitHub.
- Medusa admite UN solo handler de `completeCartWorkflow.hooks.validate`. El build descarta carpetas llamadas `test`.
- Un enlace de invitacion abierto con la sesion de admin iniciada falla ("already authenticated"): usar incognito.
- Scripts en produccion son `.js`: `NODE_ENV=production npx medusa exec ./src/scripts/<nombre>.js`.
