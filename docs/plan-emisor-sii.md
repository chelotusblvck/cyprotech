# Emisor propio de boletas contra el SII

El emisor de boletas es un servicio aparte, con su propio repositorio, para poder atender a varias marcas de
Garage360 SpA y desplegarse sin pasar por el redeploy de la tienda:

**https://github.com/chelotusblvck/garage360-dte** (privado)

El plan completo, las decisiones y el estado están allí (`docs/plan-emisor-sii.md`). Este repositorio solo guarda la
parte de la tienda: el módulo `apps/backend/src/modules/billing` y la interfaz `OpenFacturaApi`, donde el servicio
se enchufa como otro proveedor (llamada HTTP interna) sin cambiar el flujo de pedidos.

Mientras el servicio no esté certificado por el SII, `BILLING_AUTO_ISSUE=false` y las boletas se emiten a mano desde
el portal del SII.
