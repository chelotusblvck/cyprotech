# Intcomex Web Services (IWS) - notas de integración

Fuente oficial: https://iws.intcomex.com (referencia OpenAPI v1.57.6 guardada en
`docs/intcomex/iws-openapi-en.json`, bajada de https://iws.intcomex.com/reference/iws-openapi-en.json).
Contacto de integraciones: IWSIntegraciones@intcomex.com

## Ambientes

| Ambiente | Base URL |
|---|---|
| Producción | `https://intcomex-prod.apigee.net/v1/` |
| Pruebas | `https://intcomex-test.apigee.net/v1/` |

## Requisitos previos (se tramitan con Intcomex, fuera de la API)

1. Cuenta de cliente en Intcomex.
2. Usuario web asociado a esa cuenta: entrega **API Key** (pública) y **Access Key** (secreta).
3. **Registrar las IPs** desde las que se llamará a IWS. Solo esas IPs pueden consultar; otra IP
   recibe error 14. Hay que registrar la IP del VPS (y la IP pública de la oficina si se quiere probar en local).
4. Lista de productos autorizados para el cliente (define catálogo, precios y órdenes permitidas).
5. Línea de crédito pre aprobada para colocar órdenes automáticas.

## Autenticación

Cada request lleva un token en el header `Authorization: Bearer apiKey=...&utcTimeStamp=...&signature=...`.

- `utcTimeStamp`: hora UTC actual, formato `YYYY-MM-DDTHH:mm:ssZ`. Válido 5 minutos.
- `signature`: SHA-256 (hex minúscula) de la cadena `apiKey,accessKey,utcTimeStamp` (separada por comas).
- La Access Key nunca viaja en la URL ni en el body.
- Siempre HTTPS (HTTP responde 403). `Content-Type: application/json`.

Códigos de error frecuentes: 10 firma inválida, 11/12 timestamp inválido o vencido, 13 API key inválida,
14 IP no registrada, 21 producto no autorizado. Respuesta de error: `{ Message, ErrorCode, Reference }`.

## Endpoints usados

| Método | Ruta | Uso | Frecuencia recomendada |
|---|---|---|---|
| GET | `/getcatalog` | Portafolio autorizado con precio y stock | 1 vez al día |
| GET | `/downloadextendedcatalog` | URLs de imágenes y datos extendidos (~74% con imagen) | diaria o mensual |
| GET | `/getinventory` | Stock de todo el catálogo | cada hora |
| GET | `/getpricelist` | Precios de todo el catálogo | 1 vez al día |
| GET | `/getproduct` | Verificar un SKU justo antes de cobrar | por pedido; **no usar masivamente** |
| POST | `/placeorder` | Crear la orden en Intcomex | por pedido pagado |
| GET | `/getorderstatus` | Estado de una orden | polling |
| GET | `/getorder` | Detalle de orden (seriales tras facturar) | |
| POST | `/cancelorder` | Cancelar si aún no se despacha | |
| POST | `/calculateShippingRates` | Cotizar flete antes de colocar la orden | |
| GET | `/getinvoice` | Factura de la orden, para conciliación | mensual |

Estados de orden: 1 Abierta, 2 En proceso, 3 Back order, 4 Lista para entregar, 5 Facturada/Cerrada,
6 Cancelada, 7 Entregada.

## Datos clave

- `PriceData`: `UnitPrice` (neto), `CurrencyId`, `PriceTaxAmount`, `PricePlusTax`, `OriginalPrice`, `TaxRate`.
  La moneda depende de la configuración del cliente (local o USD).
- `Product`: `Sku`, `Mpn`, `Manufacturer`, `Brand`, `Category` (árbol), `Description`, `Type`
  (`Physical` o `Downloadable`), `Price`, `InStock`, `Locations`, `Upc`, `OnSale`.
- `PlaceOrder` body: `{ CustomerOrderNumber, Items: [{ Sku, Quantity }], StoreOrder: { Shipping: {...}, Customer: {...} }, Shipments: [{ ServiceType, Amount }] }`.
  `StoreOrder.Shipping` lleva la dirección del cliente final (despacho directo).
  Cada orden genera una factura de Intcomex automáticamente.
- Los productos ESD (digitales) no se pueden devolver ni mezclar con físicos en una orden: la tienda
  solo publica productos `Physical`.

## Pendiente de confirmar con Intcomex

- Formato exacto de `Shipments` (`ServiceType`, `CarrierId`) para la tarifa plana de USD 3 / USD 6.
- Moneda de nuestra cuenta (USD o CLP) y si `UnitPrice` ya incluye el descuento por nivel de membresía.
- IDs de categoría reales del portafolio de Chile (para completar `category-map.ts`).
- Límites de frecuencia (solo se documenta el error 429).
