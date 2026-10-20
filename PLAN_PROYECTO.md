# Plan: tienda de hardware gamer, con Intcomex como proveedor

Estado: propuesta para revisión. Todavía no se ha creado ni instalado nada.
Pendiente: revisar spdigital.cl y progaming.cl (fase 0) y obtener la documentación y credenciales de sandbox de la API de Intcomex.

## 1. Stack recomendado

| Capa | Elección | Motivo |
|---|---|---|
| Motor e-commerce | **Medusa v2** (Node/TypeScript) | Ya trae carrito, órdenes, clientes, promociones y un admin extensible. Los módulos propios (Intcomex, precios, socios) se montan encima. |
| Storefront | **Next.js + Tailwind + Framer Motion** | Buen SEO, SSR/ISR para catálogos grandes y animaciones tipo gamer. |
| Base de datos | **PostgreSQL** | Las órdenes y el ledger de márgenes necesitan transacciones. |
| Colas y caché | **Redis + BullMQ** | Sincronización de catálogo, reintentos y webhooks. |
| Búsqueda | **Meilisearch** | Búsqueda instantánea con filtros por marca, specs y rango de precio. |
| Proxy | **Caddy** | TLS automático y configuración simple. |
| Entorno | **Docker Compose** | El mismo stack corre en local y en el VPS. |
| CI/CD | **GitHub Actions** | Build y deploy por SSH al VPS. |

Alternativa: construir todo a medida (NestJS + Next). Da más control, pero cuesta unas 6 a 8 semanas más. Se recomienda Medusa y escribir a medida solo lo específico del negocio: precios, márgenes y socios.

## 2. Estructura del proyecto (monorepo)

```
Cyprotech/
├─ apps/
│  ├─ storefront/      Next.js, tienda pública
│  └─ backend/         Medusa, API + admin + módulos propios
│     └─ src/modules/  intcomex/ · pricing/ · fulfillment/ · ledger/ · partners/
├─ packages/
│  └─ ui/              design system (tokens neón/púrpura, componentes)
├─ infra/
│  ├─ docker-compose.yml        local
│  ├─ docker-compose.prod.yml   VPS
│  ├─ caddy/ · scripts/ · backups/
├─ docs/               decisiones, runbooks, mapeo API Intcomex
└─ .github/workflows/
```

## 3. Integración con Intcomex

- **Sincronización de catálogo:** un job programado trae productos, stock y precio de costo por nivel de membresía. Delta completo cada cierto tiempo y actualización rápida de stock y precio cada pocos minutos.
- **Costos en USD:** se guarda el costo original en USD, el tipo de cambio usado y el costo en CLP. El TC sale de una fuente diaria (mindicador.cl o Banco Central) y se guarda por fecha, de modo que cada orden sea auditable.
- **Flujo de pedido:**
  1. El cliente paga en la web.
  2. Un job crea la orden en Intcomex con la dirección del cliente (dropshipping).
  3. Intcomex devuelve el tracking, que se muestra al cliente.
  4. Si Intcomex rechaza la orden o no tiene stock, la orden queda marcada para resolver a mano: reembolso o reemplazo.
- **Verificación de stock y precio al pagar:** se vuelve a consultar a Intcomex en el checkout. Un precio desactualizado es la forma más rápida de perder el margen.
- **Imágenes y fichas:** por verificar si Intcomex las entrega. Si no, hay que enriquecerlas aparte.

## 4. Motor de precios y márgenes

```
precio_público = costo_CLP × 1,19 (IVA) × 1,10 (margen)
```

Con esa fórmula el margen neto es exactamente 10% sobre el costo (el neto de venta es costo × 1,10). Cada línea de orden guarda un **snapshot inmutable**: costo, TC, IVA, margen, envío, comisión de pasarela y neto. Los reportes se calculan siempre desde ese snapshot, nunca desde los precios actuales.

Reglas configurables: margen por categoría, redondeo (terminar en 90), precio mínimo y overrides manuales.

**Advertencia:** un 10% bruto es un margen muy ajustado. Webpay y Flow cobran entre ~1,5% y 3,5% más IVA, así que el margen real baja a algo cercano al 7%, y después hay que repartir entre los socios. El dashboard mostrará el **margen neto después de comisiones**, no solo el 10% teórico. Se recomienda margen configurable por categoría: más alto en accesorios y cables, más bajo en GPUs (muy comparables).

## 5. Dashboard de control (admin)

- **Resumen:** ventas, órdenes, ticket promedio, margen bruto y neto, por día, semana y mes.
- **Órdenes:** línea de tiempo por pedido (pagado → enviado a Intcomex → tracking → entregado), con alertas de órdenes atascadas.
- **Intcomex:** estado de la sincronización, productos sin stock, cambios de costo y órdenes rechazadas.
- **Margen** por producto, categoría y orden, con costo, TC y comisión visibles.
- **Socios (Garage360 y 2Pro):** ledger con devengado, pagado y pendiente por período, exportación a CSV/Excel y cierre mensual.
- **Finanzas:** conciliación de pagos de la pasarela contra órdenes y cuentas por pagar a Intcomex.
- **Auditoría:** quién cambió qué precio o configuración y cuándo.
- **Roles:** dueño, socio (solo lectura de su ledger) y operador.

## 6. Reparto a socios

La fórmula "5% cada uno" tiene una ambigüedad que hay que cerrar antes de programarla (ver preguntas). Técnicamente es un **ledger de doble entrada**: cada orden entregada genera asientos para la empresa, Garage360 y 2Pro. El pago se libera cuando la orden queda entregada y pasó el plazo de devolución. Los reembolsos generan asientos de reversa.

## 7. Diseño y experiencia

- **Paleta:** fondo casi negro con tintes violeta (`#0B0714`), púrpuras de `#7C3AED` a `#C084FC`, y acentos neón magenta (`#FF2BD6`), cian (`#22D3EE`) y verde lima. Glow sutil en bordes y gradientes RGB animados solo en elementos clave: botones principales, hero y barra superior.
- **Protagonismo gamer:** home con hero de ofertas, accesos por categoría (GPUs, procesadores, periféricos, monitores) y un **armador de PC** con chequeo de compatibilidad.
- **Redes y seguridad:** secciones propias con menos neón y más sobriedad (cian sobre oscuro), para que el cliente de CCTV o redes no sienta que entró a otra tienda.
- **Fichas de producto:** specs estructuradas, filtros por especificación, comparador y badges de stock, con el plazo de despacho visible (2-4 días hábiles Santiago, 4-6 regiones).
- **Tendencias eSports:** landings temáticas por juego (Valorant, CS2, LoL), bundles de "setup pro" y sección de streamers o equipos aliados.
- **Rendimiento:** imágenes optimizadas y animaciones que respetan `prefers-reduced-motion`.

## 8. Infraestructura

**Local:** `docker compose up` levanta Postgres, Redis, Meilisearch, backend, storefront y mailpit para ver correos. Datos de prueba desde el sandbox de Intcomex o un mock.

**VPS (ssh.garage360.cl):**
- Caddy en el borde con HTTPS automático y cabeceras de seguridad.
- Contenedores en red interna; solo Caddy expone 80/443.
- SSH solo por llave, fail2ban y firewall (ufw).
- Backups diarios de Postgres con `pg_dump` cifrado a almacenamiento externo, y prueba de restauración mensual.
- Monitoreo con Uptime Kuma y Sentry para errores.
- Secretos en variables de entorno del servidor, nunca en el repo.
- Deploy automático con GitHub Actions por SSH, con staging en un subdominio antes de producción.

Por confirmar los recursos del VPS: 4 GB de RAM y 2 vCPU alcanzan para arrancar; con 2 GB queda justo.

## 9. Chile: temas que no se pueden omitir

- **Pagos:** Webpay Plus (Transbank), Flow o Mercado Pago. Lo normal es uno o dos al inicio.
- **Documentos tributarios (SII):** boleta o factura electrónica por cada venta, vía Bsale, Haulmer o similar. Definir quién emite: ¿Garage360, 2Pro o una sociedad nueva?
- **Ley del Consumidor:** botón de retracto, garantía legal y política de devoluciones. Riesgo real cuando el despachador es un tercero.
- **Datos personales:** política de privacidad y consentimiento (Ley 21.719).
- **Envío:** USD 3 y USD 6 se convierten a CLP con el TC del día. Decidir si se cobra al cliente tal cual o se subsidia.

## 10. Fases

| Fase | Contenido |
|---|---|
| **0. Análisis** | Revisión de los sitios de referencia, la API de Intcomex y decisiones de negocio. |
| **1. Base** | Monorepo, Docker local, Medusa y Next funcionando, design system. |
| **2. Catálogo** | Sync de Intcomex, motor de precios, categorías y búsqueda. |
| **3. Tienda** | Home, catálogo, ficha de producto, carrito y checkout con pasarela de pago. |
| **4. Operación** | Envío de órdenes a Intcomex, tracking, correos transaccionales y boletas. |
| **5. Dashboard** | Métricas, ledger de socios y reportes. |
| **6. Deploy** | VPS, CI/CD, backups, monitoreo, pruebas de carga y de seguridad. |
| **7. Crecimiento** | Armador de PC, comparador, programa de fidelidad y SEO. |

## 11. Sugerencias para que crezca

1. **Armador de PC con compatibilidad** y venta del conjunto: sube el ticket promedio.
2. **Alertas de precio y stock** por correo o WhatsApp.
3. **SEO programático** (páginas por producto, marca y categoría), lo que más rinde para hardware.
4. **WhatsApp Business** integrado; en Chile cierra muchas ventas.
5. **Cotizador para empresas** en CCTV y redes (proyectos con instalación), con un flujo B2B aparte.
6. **Alianzas con streamers y comunidades** como canal de adquisición.
7. **Guardrail de márgenes:** alerta cuando una orden quede bajo un margen mínimo.

## Preguntas abiertas (cambian el diseño)

1. **Reparto de socios:** el "5% cada uno" ¿es sobre el **margen** o sobre la **venta**? Si fuera 5% de la venta, cada socio se llevaría casi la mitad del margen del 10%. Define el modelo contable.
2. **Margen:** ¿el 10% se aplica sobre el costo neto, con el IVA encima (como en la fórmula)? ¿O sobre el costo con IVA incluido?
3. **Comisiones:** ¿las absorbe la empresa, se descuentan antes del reparto o se trasladan al precio?
4. **Marca y dominio:** la carpeta se llama Cyprotech. ¿Es el nombre de la tienda, y qué dominio usarán?
5. **Intcomex:** ¿hay documentación de la API y credenciales de pruebas? ¿Traen imágenes y especificaciones?
6. **VPS:** ¿qué sistema operativo, RAM y vCPU tiene? ¿Hay otros servicios corriendo ahí?
7. **Facturación:** ¿qué razón social vende y qué proveedor de boletas electrónicas se prefiere?
8. **Motor:** ¿Medusa, o algo hecho a medida?
