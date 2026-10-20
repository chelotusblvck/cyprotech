# Boleta electrónica y correos

Cómo se emiten los documentos tributarios, cómo se avisa al cliente y qué falta para pasar a producción.

## Flujo

1. El cliente elige **Boleta** o **Factura** en el checkout (el RUT es opcional en boleta; en factura se validan RUT con módulo 11, razón social, giro, dirección y comuna). Se guarda en `cart.metadata.document` y pasa al pedido.
2. Al confirmarse el pago, el subscriber `order-placed-billing` emite el documento en OpenFactura y se envían dos correos: **confirmación del pedido** y **documento con el PDF adjunto**.
3. Un job (`billing-maintenance`, cada 10 minutos) consulta el estado en el SII y reintenta lo que falló.
4. Cuando Intcomex marca el pedido como despachado o entregado se avisa al cliente (una sola vez por estado).

Cada documento tiene una clave de idempotencia `<pedido>-<tipo>`, así un reintento nunca duplica un folio. Si el emisor falla, se reintenta hasta 8 veces y luego queda como **Falló**, con alerta en el dashboard y por correo (`ALERT_EMAIL`).

## Conectar OpenFactura

Variables en `apps/backend/.env`:

| Variable | Qué es |
| --- | --- |
| `OPENFACTURA_API_KEY` | API Key de la cuenta de Garage360. Vacía = modo simulado. |
| `OPENFACTURA_ENV` | `dev` (certificación, `dev-api.haulmer.com`) o `production` (`api.haulmer.com`). |
| `BILLING_EMISOR_RUT`, `_RAZON_SOCIAL`, `_GIRO`, `_ACTECO`, `_DIRECCION`, `_COMUNA` | Datos tributarios del emisor, idénticos a los de la cuenta. Obligatorios. |
| `BILLING_EMISOR_SUCURSAL`, `_CORREO` | Opcionales. |
| `BILLING_AUTO_ISSUE` | `false` desactiva la emisión automática (solo manual desde el dashboard). |
| `BILLING_AUTO_CREDIT_NOTE` | `true` emite nota de crédito sola al cancelar un pedido. Por defecto es manual. |

Pasos: obtener la API Key, completar los datos del emisor, probar con `OPENFACTURA_ENV=dev` (el SII no recibe nada), y recién entonces cambiar a `production`. El dashboard muestra "Real (dev)" o "Real (production)" en el panel *Documentos y correos*.

Validado contra la API de desarrollo de OpenFactura: boleta (39), boleta con RUT, factura (33), nota de crédito (61), idempotencia, estado "Aceptado" y descarga de PDF. Para repetir la validación: `npx medusa exec ./src/scripts/dev-validate-openfactura.ts`.

### Límites conocidos

- OpenFactura permite 3 solicitudes por segundo y 100 por minuto.
- Las boletas sobre 135 UF requieren medio de pago: no está implementado.
- La nota de crédito anula el documento completo (CodRef 1). No hay devoluciones parciales.
- El enlace público del PDF (`/documents/<token>`) solo sirve documentos de esta tienda.

## Dashboard

En *Control Cyprotech*: columna **Documento** por pedido (folio, PDF, estado SII, si se envió el correo), botón **Reintentar** si falló, **Anular** (nota de crédito, con confirmación), panel de estado de boleta y correo, y envío de un correo de prueba.

## Correos

Plantillas en `src/lib/emails/`: `order-confirmed`, `order-shipped`, `order-delivered`, `document-ready`, `internal-alert`. Tema oscuro violeta de la marca, versión de texto plano, y pie con el crédito a Garage360. Para verlas sin crear pedidos: `npx medusa exec ./src/scripts/dev-preview-emails.ts` y abrir Mailpit (http://localhost:8025).

Variables SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `SUPPORT_EMAIL`, `ALERT_EMAIL`.

- En desarrollo, sin `SMTP_HOST`, todo va a Mailpit (`127.0.0.1:1025`; no usar `localhost`, resuelve a IPv6).
- En producción sin `SMTP_HOST` **no se envía nada** y el dashboard lo marca como alerta crítica.
- Un fallo de correo nunca interrumpe un pedido, un pago ni una emisión.

### Antes de producción

1. Elegir proveedor SMTP (Zoho, Google Workspace, Resend, Amazon SES).
2. Configurar **SPF, DKIM y DMARC** del dominio remitente. Sin eso los correos caen en spam.
3. Definir `ALERT_EMAIL` para enterarse de boletas fallidas y pedidos que Intcomex no pudo recibir.
