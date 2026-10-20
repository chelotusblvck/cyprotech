# Integración de pagos con Flow

Estado: implementada y probada de punta a punta con un Flow simulado. Falta cargar las credenciales
de Flow y probar en su sandbox. Especificación oficial en `docs/flow/apiFlow.yaml`
(https://www.flow.cl/docs/api.html).

## Cómo conectar las credenciales

1. Crear la cuenta de pruebas en https://sandbox.flow.cl y, en la cuenta real de Garage360, ubicar
   **API Key** y **Secret Key** (Mi cuenta, Integración).
2. Completar en `apps/backend/.env` (en el VPS, en su `.env` de producción):
   ```
   FLOW_API_KEY=...
   FLOW_SECRET_KEY=...
   FLOW_ENV=sandbox
   BACKEND_PUBLIC_URL=https://api.cyprotech.cl      # URL pública del backend
   STOREFRONT_URL=https://cyprotech.cl              # URL pública de la tienda
   ```
   La Secret Key es secreta: no se sube al repositorio ni se comparte por chat.
3. Reiniciar el backend. Deja de usar el Flow simulado.
4. Probar un pago completo en sandbox con los datos de prueba que entrega Flow.
5. Para vender de verdad: `FLOW_ENV=production` con las credenciales de producción, y dejar
   solo Flow como medio de pago: `NODE_ENV=production npx medusa exec ./src/scripts/enable-flow.ts`
   (quita el pago manual de prueba).

Flow solo puede avisar el pago (`urlConfirmation`) si `BACKEND_PUBLIC_URL` es accesible desde internet.
En desarrollo local no lo es: no importa, la tienda confirma el pago igual cuando el cliente vuelve.

## Cómo funciona

```
Cliente elige Flow  ->  la tienda crea la sesión de pago  ->  el backend crea la orden en Flow
        (payment/create, firmada con la secretKey)         ->  devuelve url + token
Cliente presiona "Pagar con Flow"  ->  redirección a  url?token=...
Cliente paga en Flow
   |-- Flow avisa al backend:  POST /hooks/flow/confirm  (token)
   '-- Flow devuelve al cliente:  POST /api/flow/return (token)  ->  la tienda lo lleva al pedido
En ambos casos: el backend consulta payment/getStatus a Flow, y solo si está pagado completa el carrito.
```

- **Nunca se confía en el navegador ni en el aviso.** Siempre se consulta el estado a Flow con el token.
- **Un solo pedido por pago.** El aviso y el retorno del cliente pueden llegar a la vez; el segundo que llega
  devuelve el pedido ya creado. Si el cliente cierra el navegador después de pagar, el pedido se crea igual con el aviso.
- **Estados de Flow:** 1 pendiente, 2 pagada, 3 rechazada, 4 anulada. Pagada se trata como cobro inmediato.
- **Monto:** si no coincide con el del pedido, el pago no se autoriza.
- **Reintentos:** si el pago se rechaza o se cancela, el cliente vuelve al paso de pago con un aviso y, al
  continuar, se crea una orden de Flow nueva. Si el carrito cambia de monto, también se crea una orden nueva.
- **Reembolsos:** `refundPayment` crea la solicitud en Flow (`refund/create`), que es asíncrona. El aviso de
  Flow solo se registra en el log por ahora.
- **Vigencia:** una orden sin pagar vence a las 2 horas (`FLOW_ORDER_TIMEOUT_SECONDS`).

## Comisión y ledger

Flow informa en cada pago confirmado la comisión real que cobra (`paymentData.fee`) y el saldo a depositar.
El ledger de socios usa **ese valor** y deja la estimación solo como respaldo:

| | Valor |
|---|---|
| Comisión estimada por defecto | 2,89% sin IVA (abono al tercer día hábil; 3,19% con abono al día siguiente) |
| Origen en el ledger | `flow` si el pago la informó, `estimate` si se calculó con el porcentaje |

Falta confirmar con el primer pago real si el `fee` de Flow **incluye IVA**. Si lo incluye, activar en
"Socios y ledger" la opción "La comisión que informa Flow incluye IVA" y el ledger lo trabaja en neto.
Para decidirlo, comparar el `fee` de un pago con la liquidación de Flow.

## Medios de pago

Se ofrecen todos los contratados en la cuenta (`FLOW_PAYMENT_METHOD=9`). Para forzar uno, usar el
identificador que aparece en Mi datos, en Flow.

## Despacho: región como código

Las zonas de despacho se definen por región con su código ISO (`cl-rm` = Santiago, el resto = Regiones). El
formulario de dirección escribía la región como texto libre y, con eso, **ningún cliente real veía opciones de
despacho**. Ahora la región es un selector de las 16 regiones y se guarda el código. A Intcomex se le envía el nombre
de la región.

## Archivos

| Pieza | Dónde |
|---|---|
| Cliente y firma | `apps/backend/src/modules/flow/client/` |
| Proveedor de pagos de Medusa (`pp_flow_flow`) | `apps/backend/src/modules/flow/provider.ts` |
| Confirmar pago y completar carrito | `apps/backend/src/modules/flow/settle.ts` |
| Aviso de Flow | `apps/backend/src/api/hooks/flow/confirm/` |
| Consulta de la tienda | `apps/backend/src/api/store/flow/resolve/` |
| Retorno del cliente y Flow simulado | `apps/storefront/src/app/api/flow/` |
| Botón y selección de pago | `apps/storefront/src/modules/checkout/components/` |

## Flow simulado (desarrollo)

Sin credenciales, el pago redirige a una página de prueba (`/api/flow/sandbox`) con los botones Pagar, Rechazar
y Cancelar. No cobra nada y no existe en producción. Calcula una comisión de 2,89% para ejercitar la lectura de
la comisión real.

## Pendiente

1. Probar en el sandbox de Flow con credenciales reales (firma, aviso y retorno contra su servidor).
2. Confirmar si el `fee` incluye IVA y qué plazo de abono se contratará (2,89% o 3,19%).
3. Boleta electrónica (OpenFactura) al confirmarse el pago: es la siguiente pieza del flujo de venta.
4. Avisos por correo de pago confirmado, rechazado o pendiente.
5. Registrar el estado final de los reembolsos cuando Flow los avise.

## Pruebas

37 pruebas del módulo (firma contra el ejemplo de la documentación oficial, cliente, proveedor, y el flujo que
confirma el pago y completa el carrito, incluidos los casos de avisos simultáneos y errores). Total del proyecto: 166.
