# Pendientes (guardado 2026-10-22, noche)

## Urgente
- VPS con el disco al 100%. Diagnostico de solo lectura (df -h /, du -xh / --max-depth=1, docker system df, tamano de logs de contenedores y de /var/backups/cyprotech). Limpieza segura: `docker builder prune -f` y `docker image prune -f`. NO usar `docker system prune -a --volumes` ni `docker volume prune` (borran la base de datos). No borrar respaldos sin copia fuera del VPS.

## Revisar e integrar
- Rama local `mejoras-tienda` (19 commits sobre main): revisar lo visual en navegador y luego `git merge mejoras-tienda` y desplegar desde Coolify. Detalle en docs/resultado-nocturno.md.
- Completar los `[COMPLETAR]` de las paginas informativas (CONTACT en apps/storefront/src/lib/info-pages.ts) y pasar lo legal por revision.

## Datos en produccion (hacer juntos)
- Tarea 17: despublicar los 5 SKU `-B1`. Tarea 18: reimportar imagenes grandes. Tarea 19: limpiar titulos (AC000MSI29 con caracteres rotos).

## Plan completo
- docs/plan-mejoras-tienda.md, tareas 17 a 40: piso de margen 5% neto tras Flow (recargo ~8,8%), comparador de precios, despacho (3 USD + $1.000 Santiago, 6 USD + $1.000 regiones), factura en checkout (probar en sandbox), buscador y categorias nuevas, bundles, etiqueta gamer y marcas en portada, medios de pago, transferencia con descuento (~3%).

## Datos que debes entregar
- Correos y telefonos de contacto, horario, razon social/RUT/domicilio; cuenta bancaria para transferencias; medios de pago activos en Flow; kit de marca de Intcomex; lista de marcas gaming y emergentes a impulsar.
