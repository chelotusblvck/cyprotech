# Boleta electrónica y correos

Cómo se emiten los documentos tributarios, cómo se avisa al cliente y qué falta para pasar a producción.

## Flujo

1. El cliente elige **Boleta** o **Factura** en el checkout (el RUT es opcional en boleta; en factura se validan RUT con módulo 11, razón social, giro, dirección y comuna). Se guarda en `cart.metadata.document` y pasa al pedido.
2. Al confirmarse el pago, el subscriber `order-placed-billing` emite el documento en OpenFactura y se envían dos correos: **confirmación del pedido** y **documento con el PDF adjunto**.
3. Un job (`billing-maintenance`, cada 10 minutos) consulta el estado en el SII y reintenta lo que falló.
4. Cuando Intcomex marca el pedido como despachado o entregado se avisa al cliente (una sola vez por estado).

Cada documento tiene una clave de idempotencia `<pedido>-<tipo>`, así un reintento nunca duplica un folio. Si el emisor falla, se reintenta hasta 8 veces y luego queda como **Falló**, con alerta en el dashboard y por correo (`ALERT_EMAIL`).

## Conectar el servicio de boletas de Garage360 (reemplaza a OpenFactura)

Garage360 emite sus boletas con un servicio propio, en su propio repositorio (`garage360-dte`), que atiende a todas sus tiendas.
Esta tienda lo usa en lugar de OpenFactura con **dos variables** en el backend:

| Variable | Qué es |
| --- | --- |
| `DTE_SERVICE_URL` | Dirección del servicio, por ejemplo `https://dte.garage360.cl`. |
| `DTE_SERVICE_TOKEN` | El token de **esta tienda** (el servicio lo deduce de él; no hay que decir quién es). Secreto. |

Si están las dos, **el servicio tiene prioridad sobre OpenFactura**. Las variables `BILLING_EMISOR_*` y `OPENFACTURA_*` dejan de
hacer falta: los datos del emisor, los folios, el timbre y el envío al SII viven en el servicio. El flujo de pedidos, los
reintentos, las alertas y el correo con el PDF son los mismos.

Qué cambia respecto a OpenFactura:

- **Solo boletas.** Si un cliente pide factura, esa emisión falla **sin reintento** y avisa: hay que emitirla a mano.
- **Token del documento = `folio-código`.** El enlace de descarga del correo (`/documents/<token>`) lleva un código que no se puede
  adivinar. El folio solo es consecutivo: nunca se acepta solo.
- **Anulaciones.** Una boleta se anula con una Nota de Crédito electrónica. Garage360 está inscrita solo en boletas, así que la nota
  se emite **a mano en el portal del SII** (*Servicios online → Boleta de ventas y servicios electrónica → Emitir nota de crédito
  electrónica*; con Clave Tributaria o Clave Única y captcha). Al anular desde el dashboard (o al cancelar un pedido con
  `BILLING_AUTO_CREDIT_NOTE=true`) la tienda registra la solicitud en el servicio, deja la nota en estado `manual_pending` y envía una
  alerta con los pasos. Cuando la nota está emitida se registra con su folio:

  `POST /admin/billing/documents/<id de la boleta>/credit-note/confirm` con `{ "folio": 7701, "date": "2026-11-07" }`

  (la fecha es opcional). La boleta pasa a figurar anulada en el servicio, en su PDF y en su página pública de consulta.
  Emitir la nota de crédito automáticamente exigiría inscribirse como facturador electrónico y certificar factura, nota de crédito y
  nota de débito.
- **Estado.** El servicio informa `FIRMADO`, `ENVIADO`, `ACEPTADO` o `RECHAZADO`; la tienda lo muestra como Pendiente, Aceptado o
  Rechazado. Si el servicio no tiene folios (503 `sin_folios`) la emisión se reintenta y avisa.

Contrato completo del servicio: `docs/integracion.md` del repositorio `garage360-dte`. Despliegue: `docs/despliegue-coolify.md` de ese repositorio.

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

**Producción sin API Key:** el sistema no simula. Con `NODE_ENV=production` y sin `OPENFACTURA_API_KEY`, cada emisión falla con un error claro (una sola alerta, sin reintentos automáticos) y el pedido queda con el documento en "Falló". Cuando ya esté la clave se reintenta a mano desde el dashboard. El emisor simulado solo existe en desarrollo.

**Cuándo emitir:** al confirmarse el pago, que es lo que hace el sistema. No dejar la emisión en un lote diario: emitir tarde es infracción. Confirmar con el contador el momento exacto para la factura (pago o despacho).

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

Plantillas en `src/lib/emails/`: `order-confirmed`, `order-shipped`, `order-delivered`, `document-ready`, `internal-alert`, `staff-invite`. Tema oscuro violeta de la marca, versión de texto plano, y pie con el crédito a Garage360. Para verlas sin crear pedidos: `npx medusa exec ./src/scripts/dev-preview-emails.ts` y abrir Mailpit (http://localhost:8025).

Variables SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `SUPPORT_EMAIL`, `ALERT_EMAIL`.

- En desarrollo, sin `SMTP_HOST`, todo va a Mailpit (`127.0.0.1:1025`; no usar `localhost`, resuelve a IPv6).
- En producción sin `SMTP_HOST` **no se envía nada** y el dashboard lo marca como alerta crítica.
- Un fallo de correo nunca interrumpe un pedido, un pago ni una emisión.

### Invitar administradores

Settings > Users > Invite en el admin (`/app`). Medusa crea la invitación pero no envía correo por sí solo: el suscriptor `src/subscribers/staff-invite-email.ts` escucha `invite.created` e `invite.resent` y manda la plantilla `staff-invite` por el SMTP, con un enlace `BACKEND_PUBLIC_URL/app/invite?token=...` donde la persona crea su propia clave (el enlace es de un solo uso y vence a los 7 días; *Resend* en la invitación genera uno nuevo).

- Si el correo no llega (SMTP caído, remitente sin verificar), la invitación sigue válida: en la lista de invitaciones, menú `...` > *Copy invite link*, y se entrega el enlace por un canal privado.
- El correo viaja desde `MAIL_FROM`; con el dominio sin verificar en Resend puede caer en spam o rebotar.

### Antes de producción

1. Elegir proveedor SMTP (Zoho, Google Workspace, Resend, Amazon SES).
2. Configurar **SPF, DKIM y DMARC** del dominio remitente. Sin eso los correos caen en spam.
3. Definir `ALERT_EMAIL` para enterarse de boletas fallidas y pedidos que Intcomex no pudo recibir.
