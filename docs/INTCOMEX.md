# Integración con Intcomex y motor de precios

Estado: implementada y probada con un catálogo simulado. Falta cargar las credenciales reales.
Especificación oficial en `docs/intcomex/` (ver `NOTAS-API.md` y `iws-openapi-en.json`).

## Cómo conectar las credenciales (cuando Intcomex las envíe)

1. Pedir a Intcomex, además del API Key y la Access Key:
   - registrar la **IP del VPS** (y la de la oficina si se quiere probar desde local); sin eso responde error 14;
   - confirmar la moneda de la cuenta (USD o CLP) y la línea de crédito para órdenes automáticas.
2. Completar en `apps/backend/.env` (en el VPS, en su `.env` de producción):
   ```
   INTCOMEX_API_KEY=...
   INTCOMEX_ACCESS_KEY=...
   INTCOMEX_ENV=test
   ```
   La Access Key es secreta: no se sube al repositorio ni se comparte por chat.
3. Reiniciar el backend. Desde ese momento deja de usar el catálogo simulado.
4. Primera prueba controlada (primero en `test`, luego en `production`):
   ```
   cd apps/backend
   npx medusa exec ./src/scripts/sync-intcomex.ts catalog dry-run     # solo informa
   npx medusa exec ./src/scripts/sync-intcomex.ts catalog limit=50    # carga 50 productos
   ```
   Revisar en el admin que precios, categorías y stock sean correctos antes de cargar todo.
5. Con credenciales reales las sincronizaciones programadas se activan solas.

## Qué hace

| Pieza | Dónde | Función |
|---|---|---|
| Cliente IWS | `src/modules/intcomex/client/` | Firma SHA-256, reintentos ante 429/5xx, errores tipados. Cliente simulado cuando no hay credenciales. |
| Mapeo de categorías | `src/modules/intcomex/category-map.ts` | Convierte la categoría de Intcomex en una de las nuestras. Lo no reconocido queda en borrador. |
| Sincronización | `src/modules/intcomex/sync/` | Catálogo (diario 03:00), precios (03:30), inventario (cada hora). Idempotente. |
| Precios | `src/lib/pricing/` | Fórmula de abajo, tipo de cambio desde mindicador.cl. |
| Verificación al pagar | `src/workflows/hooks/verify-intcomex-at-checkout.ts` | Consulta stock y costo en Intcomex antes de cobrar (`GetProduct`). |
| Colocar pedido | `src/workflows/place-intcomex-order.ts` | Crea la orden en Intcomex con despacho directo al cliente y guarda el snapshot de márgenes. |
| Estado de pedidos | `src/modules/intcomex/orders/status.ts` | Cada 30 min consulta estado y guarda el seguimiento. |
| API del dashboard | `src/api/admin/intcomex/` | `status`, `sync`, `products`, `orders`, `orders/:id/place`. |

## Fórmula de precios

```
precio neto de venta = costo neto x tipo de cambio x (1 + margen)      margen = 10%
precio público       = precio neto de venta x (1 + IVA)                IVA = 19%
```

Se redondea hacia arriba a múltiplos de `PRICING_ROUND_TO` (10 CLP). El margen efectivo queda en 10,00-10,01%.
El tipo de cambio sale de mindicador.cl una vez al día (se guarda en `intcomex_fx_rate`); si falla la red se usa
el último valor guardado y el estado lo marca como desactualizado. `FX_USD_CLP_OVERRIDE` fija un valor manual.

Reglas de actualización: un aumento de costo se aplica siempre; una baja solo si es 0,5% o más (evita cambiar
precios por centavos). El feed de inventario nunca toca precios.

## Reglas de publicación

Un producto se publica si tiene categoría reconocida y stock igual o mayor a `INTCOMEX_MIN_STOCK` (3).
Cuando el stock cruza ese umbral el producto pasa a borrador o vuelve a publicarse; si un administrador oculta
un producto a mano, la sincronización no lo vuelve a publicar mientras el stock no cruce el umbral.
Los productos que Intcomex deja de listar se desactivan (borrador, stock 0), no se borran.
Solo se cargan productos de tipo `Physical`: los digitales (ESD) no se pueden devolver y no se mezclan con físicos.

## Pedidos

- Por defecto el pedido se coloca **a mano** (`POST /admin/intcomex/orders/:id/place`). Es idempotente.
- `INTCOMEX_AUTO_PLACE_ORDERS=true` lo hace al confirmar la compra; activarlo cuando Flow esté integrado y
  Intcomex haya aprobado la línea de crédito.
- Si Intcomex rechaza la orden, queda como `failed` con su mensaje para resolverla desde el dashboard.
- Cada pedido guarda por línea: costo, tipo de cambio, costo en CLP y margen neto. Es la base del ledger de socios.
  Hoy el costo sale del catálogo local; la conciliación contra `GetInvoice` queda para la fase del ledger.

## Pendiente de confirmar con Intcomex

1. Formato del flete en `PlaceOrder` (`Shipments.ServiceType`) para la tarifa plana de USD 3 / USD 6.
2. Moneda de la cuenta y si `UnitPrice` ya incluye el descuento por nivel de membresía.
3. IDs de categoría reales de Chile para afinar `category-map.ts` (hoy se basa en el texto de la categoría).
4. Formato de `DownloadExtendedCatalog` (imágenes, ~74% de los productos): respuesta binaria sin esquema
   documentado; se implementa con una muestra real.
5. Límites de frecuencia (solo documenta el error 429).

## Pruebas

```
cd apps/backend
TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules npx jest --runInBand src
```

83 pruebas unitarias (precios, firma, cliente, mapeo, planificador de sincronización, tipo de cambio,
pedido y verificación al pagar). En Windows hay que fijar las variables como arriba (el script `test:unit` usa sintaxis POSIX).
