# Pago por transferencia directa (tareas 35 y 36)

Medio de pago propio (`pp_transfer_transfer`), sin comision de pasarela, con descuento sobre los productos.

## Como funciona

1. El cliente elige "Transferencia bancaria" en el checkout. La tienda aplica la promocion `TRANSFERENCIA`
   (porcentaje `TRANSFER_DISCOUNT_PERCENT`, nunca mayor que `PRICING_PAYMENT_FEE_PERCENT`, asi el margen no
   baja del piso de la tarea 21). Si cambia a Flow, la promocion se quita. El backend impide completar una
   compra con el codigo y otro medio de pago.
2. Al realizar el pedido, el pedido se crea con el pago AUTORIZADO pero SIN CAPTURAR. En ese estado:
   - se envia al cliente el correo "falta tu transferencia" con los datos bancarios y el plazo;
   - NO se emite boleta/factura, NO se envia la confirmacion, NO se coloca el pedido en Intcomex.
3. Cuando ves el deposito, en el admin abre el pedido y usa **Capturar pago**. Eso dispara
   (`subscribers/payment-captured-transfer.ts`): correo de pedido confirmado, boleta/factura (si
   `BILLING_AUTO_ISSUE` no es `false`) y pedido a Intcomex (si `INTCOMEX_AUTO_PLACE_ORDERS=true`).
4. Si no llega el pago dentro de `TRANSFER_DEADLINE_HOURS` (48 por defecto), el job `transfer-expire-orders`
   (cada hora) cancela el pedido y se libera el stock reservado.

Los pedidos de Flow no cambian: el pedido nace ya pagado y los subscribers actuan como antes.

## Puesta en marcha (en este orden)

1. En Coolify, variables del backend: `TRANSFER_BANK_HOLDER`, `TRANSFER_BANK_RUT`, `TRANSFER_BANK_NAME`,
   `TRANSFER_BANK_ACCOUNT_TYPE`, `TRANSFER_BANK_ACCOUNT_NUMBER`, `TRANSFER_BANK_EMAIL`. Opcionales:
   `TRANSFER_DISCOUNT_PERCENT` (2.5), `TRANSFER_DEADLINE_HOURS` (48).
2. Desplegar el backend y ejecutar en su terminal: `npx medusa exec ./src/scripts/setup-transfer.ts`
   (habilita el medio en la region Chile y crea la promocion; falla si faltan datos bancarios).
3. Variables de la tienda: `NEXT_PUBLIC_TRANSFER_ENABLED=true` (muestra el precio con descuento en la ficha) y,
   si cambiaste el porcentaje, `NEXT_PUBLIC_TRANSFER_DISCOUNT_PERCENT`. Desplegar la tienda.
4. Probar en sandbox: pedido por transferencia -> correo con datos bancarios -> pedido sin boleta -> Capturar pago
   en el admin -> correo de confirmacion y boleta. Probar tambien que Flow siga igual y que el pedido sin pago
   se cancele pasado el plazo (bajar `TRANSFER_DEADLINE_HOURS` para probarlo).

## Limitaciones conocidas

- El reembolso de una transferencia es manual (el proveedor no mueve dinero).
- La pagina de confirmacion no muestra los datos bancarios; van en el correo. Si hace falta verlos en pantalla,
  hay que exponerlos con un endpoint de la tienda.
- Un pedido por transferencia reserva stock durante el plazo.
