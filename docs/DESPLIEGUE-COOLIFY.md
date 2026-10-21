# Despliegue en el VPS con Coolify

VPS: `216.185.51.16` (Ubuntu 22.04, 2 vCPU, 3,8 GB RAM, swap 2 GB). Coolify ya corre ahí con Traefik en los puertos 80 y 443.
Las claves y secretos se cargan en la interfaz de Coolify: **no hay archivo `.env` en el servidor**.

## Estado verificado

Probado en local con Docker, con las mismas imágenes y el mismo compose:

- El backend compila, aplica las migraciones sobre una base vacía, arranca, sirve el admin y responde `/health`.
- La tienda compila en modo `standalone`, arranca y renderiza la portada contra ese backend.
- Memoria en reposo: backend ~380 MB, Postgres ~70 MB, Redis ~15 MB, tienda ~75 MB. Cabe en el VPS junto a las apps actuales.
- Disco del VPS: se limpió la caché de builds de Docker (12,4 GB). Hoy quedan 19 GB libres (48% de uso).

Lo que no se pudo probar sin el VPS ni dominio: certificados, dominios reales, el aviso de Flow y la conexión con Intcomex.

## Piezas

| Archivo | Para qué |
| --- | --- |
| `apps/backend/Dockerfile` | Imagen del backend (build multi-etapa; arranca con `docker-entrypoint.sh`, que migra y luego inicia). |
| `apps/storefront/Dockerfile` | Imagen de la tienda (Next.js `standalone`). Las `NEXT_PUBLIC_*` entran como build args. |
| `infra/docker-compose.coolify.yml` | Postgres + Redis + backend, con límites de memoria. Todo `${VAR}` se declara en Coolify. |

> Coolify ejecuta compose con `--project-directory` en la raíz del repo, por eso el `context` del backend es `.` (no `..`). Para probarlo en local usa `docker compose --project-directory . -f infra/docker-compose.coolify.yml build`.
| `.dockerignore` | Deja fuera `node_modules`, `.env` y builds locales. |

## Orden de despliegue

Son dos recursos en Coolify porque la tienda necesita la *publishable key*, que solo existe cuando el backend ya corrió.

### Antes de empezar

1. Subir el repositorio a GitHub (privado). Hoy es solo local (`git init`, sin commits ni remoto).
2. Dominio provisorio: `cypro.garage360.cl` (tienda) y `cypro-api.garage360.cl` (backend). Se usan subdominios de **un solo nivel** porque el certificado universal de Cloudflare no cubre `api.cypro.garage360.cl`. `garage360.cl` está detrás de Cloudflare con comodín, así que ya resuelven; en Cloudflare usar SSL/TLS en modo **Full** (no Flexible) para que Traefik emita su certificado. Al comprar `cyprotech.cl` en NIC.cl basta cambiar las variables de abajo y los dominios en Coolify.
3. En Coolify, conectar el repositorio (GitHub App o deploy key).

### 1. Núcleo (Docker Compose)

Nuevo recurso → Docker Compose → archivo `infra/docker-compose.coolify.yml`. En *Environment Variables* definir:

| Variable | Valor |
| --- | --- |
| `POSTGRES_PASSWORD`, `JWT_SECRET`, `COOKIE_SECRET` | Generar al azar (`openssl rand -hex 32`). Distintos entre sí. |
| `MAIL_FROM` | Mientras no haya dominio propio: una casilla de `garage360.cl` que ya tenga SPF y DKIM, por ejemplo `Cyprotech <no-reply@garage360.cl>`. |
| `STORE_CORS` | `https://cypro.garage360.cl` |
| `ADMIN_CORS`, `AUTH_CORS` | `https://cypro-api.garage360.cl` |
| `BACKEND_PUBLIC_URL` | `https://cypro-api.garage360.cl` |
| `STOREFRONT_URL` | `https://cypro.garage360.cl` |

Las demás (Intcomex, Flow, OpenFactura, SMTP) tienen valor por defecto seguro y se rellenan cuando lleguen las credenciales: `INTCOMEX_*`, `FLOW_*`, `OPENFACTURA_*`, `BILLING_EMISOR_*`, `SMTP_*`, `MAIL_FROM`, `SUPPORT_EMAIL`, `ALERT_EMAIL`. Marcarlas como secretas en Coolify.

Dominio del servicio **backend**: `https://cypro-api.garage360.cl`, puerto 9000. Desplegar.

### 2. Preparar la tienda (una sola vez)

Desde la terminal de Coolify del contenedor `backend` (o `docker exec` en el VPS):

```
npx medusa user -e correo@dominio.cl -p CLAVE-LARGA          # administrador
npx medusa exec ./src/scripts/setup-chile.js                  # región Chile, IVA, despacho, categorías
```

`setup-chile` **borra productos, categorías y despachos** para dejar la tienda limpia, por eso se niega a correr si ya existe la región Chile (salvo `SETUP_FORCE=true`).

Después, en el admin (`https://cypro-api.garage360.cl/app`): *Settings → Publishable API Keys* y copiar la clave que ya viene creada (`pk_...`).

### 3. Tienda (aplicación con Dockerfile)

Nuevo recurso → Application → mismo repositorio → *Build Pack: Dockerfile*, ruta `apps/storefront/Dockerfile`, **base directory `/`** (el contexto de build es la raíz). Variables (marcar *Build Variable*):

| Variable | Valor |
| --- | --- |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | `https://cypro-api.garage360.cl` |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | la `pk_...` del paso anterior |
| `NEXT_PUBLIC_BASE_URL` | `https://cypro.garage360.cl` |
| `NEXT_PUBLIC_DEFAULT_REGION` | `cl` |

Puerto 8000. Dominio `https://cypro.garage360.cl`. Límite de memoria sugerido: 400 MB.

### 4. Salir a vender

1. Flow: `FLOW_ENV=sandbox` con las claves de sandbox, probar un pago completo; luego `production` con las reales.
2. Dejar solo Flow como medio de pago: `NODE_ENV=production npx medusa exec ./src/scripts/enable-flow.js`.
3. Pedirle a Intcomex que registre la IP `216.185.51.16`. Cargar `INTCOMEX_*` y lanzar la primera sincronización desde *Control Cyprotech*.
4. OpenFactura: `OPENFACTURA_ENV=dev` hasta validar, luego `production` con los datos reales del emisor Garage360.
5. SMTP con SPF, DKIM y DMARC del dominio remitente.

## Riesgos y cuidados en este VPS

- **Memoria al compilar.** Compilar la tienda o el backend en el VPS usa 1,5 GB o más y puede coincidir con las otras apps. Se acotó (`--max-old-space-size=1536`) y hay 2 GB de swap, pero conviene desplegar en horas tranquilas. Si se vuelve un problema, construir las imágenes en GitHub Actions y que Coolify solo las descargue.
- **Respaldos: todavía no existen.** Antes de recibir pedidos reales, crear una tarea programada en Coolify (servicio `postgres`, diaria) que ejecute `pg_dump -U cyprotech cyprotech | gzip > /backups/cyprotech-$(date +%F).sql.gz` y borre los de más de 14 días. El volumen `pgbackups` ya está en el compose. Además, copiar esos archivos fuera del VPS (la base es lo único irrecuperable).
- **Panel de Coolify expuesto.** El puerto 8000 del VPS está abierto a internet y sirve el panel. Conviene cerrarlo y entrar por un dominio con HTTPS, o limitarlo por IP.
- **Disco.** La caché de builds vuelve a crecer con cada despliegue. Programar `docker builder prune -af --filter until=72h` semanal.
- **Zona horaria de los jobs.** Los trabajos programados (catálogo 03:00, precios 03:30) usan la hora del contenedor (UTC). Es consistente, pero no coincide con la hora de Chile.
