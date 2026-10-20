# Cyprotech

Tienda de hardware (gaming, PC, redes y seguridad). Ver `PLAN_PROYECTO.md` y `docs/DECISIONES.md`.

## Estructura

- `apps/backend` — Medusa v2 (API, admin, módulos propios)
- `apps/storefront` — Next.js (tienda pública)
- `infra/docker-compose.yml` — Postgres, Redis y Mailpit para desarrollo local

## Desarrollo local

```
pnpm install
pnpm infra:up                      # Postgres :5432, Redis :6379, Mailpit :8025
pnpm --filter @cyprotech/backend dev       # API http://localhost:9000 · Admin http://localhost:9000/app
pnpm --filter @cyprotech/storefront dev    # Tienda http://localhost:8000
```

Variables: `.env` (raíz, infra) y `apps/backend/.env`, `apps/storefront/.env.local`. Ninguna se versiona.

## Documentación

- `PLAN_PROYECTO.md` - plan y arquitectura
- `docs/DECISIONES.md` - decisiones de negocio y técnicas
- `docs/INTCOMEX.md` - integración con Intcomex, precios y cómo cargar las credenciales
- `docs/FLOW.md` - pagos con Flow: cómo conectar las credenciales y cómo funciona
- `docs/DASHBOARD-LEDGER.md` - dashboard de control, ledger de socios y cierre mensual
- `docs/BOLETA-Y-CORREOS.md` - boleta y factura electrónica (OpenFactura) y correos transaccionales
- `docs/DESPLIEGUE-COOLIFY.md` - despliegue en el VPS con Coolify, orden de pasos y cuidados
- `docs/intcomex/` - especificación oficial de la API y notas
