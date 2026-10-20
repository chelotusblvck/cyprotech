# Decisiones de negocio y técnicas (fase 0)

Fuente: respuestas del dueño del proyecto a las preguntas abiertas de PLAN_PROYECTO.md.

## Modelo financiero

- **Precio neto de venta** = costo neto Intcomex (USD) × tipo de cambio × 1,10
- **Precio público** = precio neto de venta × 1,19 (IVA)
- **Utilidad neta por orden** = precio neto de venta − costo neto Intcomex − comisión pasarela (Webpay/Flow) − costo del facturador − hosting.
- **Reparto de socios:** 50% / 50% (Garage360 / 2Pro) de la utilidad neta, nunca de la venta.
- Garage360 emite las boletas y recibe los pagos; absorbe comisiones y facturador, que se descuentan antes del reparto.
- Envío (USD 3 Santiago / USD 6 regiones): se trata como pass-through, no entra al margen. **Por confirmar.**

## Puntos a modelar en el ledger (no definidos aún)

- Hosting es un costo mensual fijo: hay que definir cómo se prorratea por orden (por orden, por % de venta o descuento global al cierre mensual).
- Costo del facturador (~$9.990 + IVA/mes) tiene la misma situación.
- Si una orden se reembolsa o devuelve, el asiento se revierte y las comisiones ya pagadas no se recuperan: quién las absorbe.
- Utilidad neta negativa en una orden: el ledger debe permitirlo (pérdida compartida).

## Marca y dominio

- **Cyprotech** = marca sombrilla. Dominio vía NIC.cl (ej. `cyprotech.cl`), pendiente de compra.
- Sección gamer neón/púrpura + diseño más sobrio para infraestructura/B2B.

## Intcomex

- Portal IWS (`iws.intcomex.com`), REST. Endpoints reportados: catálogo, stock y lista de precios. **Verificar nombres y formatos reales contra la documentación oficial antes de codificar.**
- Sync de catálogo/precios diaria y consulta de stock en el checkout, con BullMQ.
- Imágenes cubren ~74% del catálogo: fallback o enriquecimiento obligatorio.

## Infraestructura

- VPS Cloud-1 de v2Networks, 4 GB RAM / 2 vCPU.
- **Swap de 2 GB obligatorio** (Postgres + Redis + Meilisearch + Medusa + Caddy).
- Revisar si Meilisearch cabe en ese presupuesto de RAM; alternativa: búsqueda de Postgres (pg_trgm / FTS) al inicio.

## Facturación

- Razón social: **Garage360**. Proveedor: **OpenFactura (Haulmer)**, integrado por API/webhooks desde Medusa.

## Motor

- **Medusa v2** (TypeScript) + Next.js. Código propio solo para: módulo Intcomex, motor de márgenes, pasarela, ledger de socios.

## Actualización (integración Intcomex)

- **Pasarela de pago:** Flow (la misma de Garage360). La integración queda para la fase de pagos; hoy solo existe el método de prueba de Medusa.
- **Caché de la tienda al sincronizar:** se resuelve en una fase posterior (invalidación al cambiar el catálogo).
- **Datos de Intcomex verificados** contra la especificación oficial (OpenAPI v1.57.6): endpoints reales `getcatalog`, `getinventory`, `getpricelist`, `getproduct`, `placeorder`, `getorderstatus`. Detalle en `docs/intcomex/NOTAS-API.md`.
- **Precios:** la fórmula del punto 2 de este documento está implementada y probada (ver `docs/INTCOMEX.md`).
- **Flete:** el pedido a Intcomex no informa flete hasta confirmar el formato; la tarifa plana de la tienda se cobra al cliente de forma independiente.

## Actualización (dashboard y ledger)

- Reparto sobre la utilidad neta real, 50% Garage360 / 50% 2Pro, implementado como libro de asientos (`docs/DASHBOARD-LEDGER.md`).
- Supuestos a confirmar: plazo de 10 días tras la entrega, arrastre de pérdidas, comisión de Flow sin IVA y hosting como costo fijo mensual.
- Falta cargar la comisión real de Flow y el costo del hosting en la configuración del ledger.

## Actualización (Flow)

- Flow integrado como medio de pago (`docs/FLOW.md`). Comisión de referencia 2,89% + IVA con abono al tercer día hábil (3,19% al día siguiente); el ledger usa la comisión real que informa Flow en cada pago.
- Pendiente confirmar: si el `fee` de Flow incluye IVA y qué plazo de abono se contrata.
- La región del cliente es ahora un selector con código ISO; es lo que habilita las zonas de despacho (Santiago y Regiones).

## Actualización (boleta electrónica y correos)

- Documentos tributarios con OpenFactura (`docs/BOLETA-Y-CORREOS.md`). El cliente elige boleta o factura en el checkout; se emite al confirmarse el pago, de forma idempotente y con reintentos. Las notas de crédito son manuales por defecto.
- Correos transaccionales con diseño de marca (confirmación, despacho, entrega, documento con PDF adjunto) por SMTP; las alertas internas llegan a `ALERT_EMAIL`.
- Pendiente: datos reales del emisor Garage360 (RUT, giro, acteco, sucursal), API Key de producción, proveedor SMTP con SPF/DKIM/DMARC y medio de pago para boletas sobre 135 UF.
