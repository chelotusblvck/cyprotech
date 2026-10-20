# Dashboard de control y ledger de socios

Se usa desde el admin de Medusa (`http://localhost:9000/app` en local) con dos secciones nuevas en el menú:
**Control Cyprotech** y **Socios y ledger**. Todo el reparto se calcula en CLP **neto, sin IVA**.

## Control Cyprotech

- Ventas con IVA y netas, ticket promedio, margen bruto, comisión de pasarela y utilidad antes de costos fijos,
  para los últimos 7, 30, 90 o 365 días. Gráfico de ventas por día (con tabla alternativa).
- Pedidos recientes con su estado en Intcomex (colocado, falló, sin colocar), si la utilidad ya se reconoció y el margen.
  Los pedidos sin colocar o fallidos tienen botón **Colocar / Reintentar**.
- Panel Intcomex: modo (real o simulado), dólar vigente, productos sin categoría, bajo stock mínimo, pedidos fallidos
  y última sincronización de catálogo, precios e inventario, con botón para sincronizar a mano.
- Alertas: pedidos fallidos o sin colocar hace más de 2 horas, comisión de Flow sin configurar, sincronizaciones que
  fallaron, dólar desactualizado, productos sin categoría y modo simulado.

## Cómo se calcula la utilidad

```
margen del pedido      = venta neta de los productos - costo neto Intcomex (al dólar del día)
comisión de pasarela   = la comisión real que informó Flow; si no viene, total pagado x % de Flow + cargo fijo
contribución del pedido = margen - comisión de pasarela

utilidad neta del mes  = suma de contribuciones reconocidas
                         - costos fijos (OpenFactura, hosting, otros) - gastos manuales
                         - reversas por devoluciones +/- ajustes
a repartir             = utilidad neta - pérdida arrastrada de meses anteriores
cada socio             = a repartir x su porcentaje   (50% Garage360 / 50% 2Pro)
```

El despacho (USD 3 / USD 6) se trata como traspaso: no entra al margen, pero sí cuenta dentro del total sobre el que
Flow cobra su comisión.

## Ciclo de un pedido en el ledger

1. **Colocado en Intcomex**: se guarda con su margen y comisión calculados en ese momento (estado "Por reconocer").
2. **Entregado**: el estado de Intcomex (consultado cada 30 min) inicia el plazo de retracto.
3. **Reconocido**: pasados `holdDays` (10) desde la entrega, el trabajo diario de las 04:00 registra el margen y la
   comisión en el mes en curso. También se puede forzar con el botón **Reconocer utilidad**.
4. **Cancelado o devuelto**: si aún no estaba reconocido se anula sin asientos; si ya estaba, se registra una reversa
   del margen (la comisión de Flow no se recupera).

Los asientos solo se agregan, nunca se editan ni se borran: una corrección es otro asiento. Los reintentos no
duplican asientos.

## Cierre mensual y pagos

- **Cerrar período** registra los costos fijos pendientes del mes, congela los totales y genera un pago por socio.
- El mes en curso no se puede cerrar sin confirmar; los meses se cierran en orden.
- Un movimiento nunca cae en un mes cerrado: pasa al siguiente mes abierto.
- Si el mes termina en pérdida no se paga nada y la pérdida se descuenta de las utilidades siguientes
  (configurable, ver abajo).
- **Marcar pagado** guarda la fecha y el folio de la transferencia. **Exportar CSV** entrega los asientos y el reparto
  del mes (abre bien en Excel).

## Configuración (sección inferior de "Socios y ledger")

| Ajuste | Valor inicial |
|---|---|
| Socios y porcentajes | Garage360 50% / 2Pro 50% (deben sumar 100) |
| Comisión de Flow (estimada) | 2,89% sin IVA. Si el pago informa la comisión real de Flow, se usa esa (ver `docs/FLOW.md`) |
| Cargo fijo por transacción | 0 |
| La comisión de Flow incluye IVA | No (confirmar con el primer pago real) |
| Días de retracto tras la entrega | 10 |
| Arrastrar pérdidas al mes siguiente | Sí |
| Costos fijos mensuales | OpenFactura (Haulmer) $9.990 neto. Falta el hosting. |

Los cambios aplican a los pedidos que se registren desde ese momento y a los cierres futuros; los pedidos ya
registrados conservan la comisión con la que se calcularon.

## Decisiones que asumí y conviene confirmar

1. **Plazo de 10 días tras la entrega** antes de reconocer utilidad (referencia al derecho de retracto en compras online).
2. **Arrastre de pérdidas**: una pérdida mensual no se reparte y se recupera antes de pagar utilidades futuras. Si se
   prefiere repartirla entre los socios, se desactiva el ajuste.
3. **Comisión de Flow sin IVA**: se ingresa el porcentaje neto; el IVA de la comisión se recupera como crédito fiscal.
4. **El costo del pedido sale del catálogo local** (último costo sincronizado). Cuando se integre `GetInvoice` se
   concilia contra el costo facturado real por Intcomex.
5. **Hosting y facturador** son costos fijos mensuales que se cargan al cerrar, no por pedido.

## API (todas bajo `/admin`, requieren sesión de administrador)

| Ruta | Función |
|---|---|
| `GET /admin/cyprotech/summary?days=30` | Datos del dashboard |
| `GET /admin/ledger/periods` | Meses con movimiento y su estado |
| `GET /admin/ledger/summary?period=2026-10` | Totales, reparto y asientos del mes |
| `POST /admin/ledger/entries` | Gasto o ajuste manual |
| `POST /admin/ledger/periods/:period/close` | Cierra el mes |
| `POST /admin/ledger/payouts/:id/pay` | Marca un pago como pagado |
| `GET/POST /admin/ledger/settings` | Configuración del reparto |
| `GET /admin/ledger/export?period=2026-10` | CSV del mes |
| `POST /admin/ledger/release` | Reconoce utilidad de pedidos entregados |

## Herramientas de desarrollo

`src/scripts/dev-seed-ledger-demo.ts` crea pedidos de muestra en varios meses para ver el dashboard con datos, y
`src/scripts/dev-clean-demo.ts` los borra (también vacía el ledger y los registros de Intcomex, y restablece la
configuración). **Nunca ejecutarlos en producción.**

```
cd apps/backend
npx medusa exec ./src/scripts/dev-seed-ledger-demo.ts
npx medusa exec ./src/scripts/dev-clean-demo.ts
```

## Pruebas

123 pruebas unitarias en total; el ledger tiene 40 (cálculo, asientos, reconocimiento, reversas, cierre ordenado,
arrastre de pérdidas, pagos e idempotencia).
