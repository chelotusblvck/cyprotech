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
2. Dominio: `cyprotech.cl` (registros A de `cyprotech.cl` y `www` hacia `216.185.51.16`, con proxy de Cloudflare y SSL/TLS en modo **Full**). Un solo dominio para todo: la tienda atiende la raíz y el backend solo las rutas de Medusa (`/app`, `/admin`, `/store`, `/auth`, `/hooks`, `/static`, `/health`), enrutadas con las etiquetas de Traefik del servicio `backend` en `infra/docker-compose.coolify.yml`. El admin se usa en `https://cyprotech.cl/admin`, que redirige a `/app` (la interfaz no puede vivir en `/admin` porque esa ruta es la API del admin). Los dominios provisorios `cypro*.garage360.cl` quedan solo como respaldo mientras se verifica.
3. En Coolify, conectar el repositorio (GitHub App o deploy key).

### 1. Núcleo (Docker Compose)

Nuevo recurso → Docker Compose → archivo `infra/docker-compose.coolify.yml`. En *Environment Variables* definir:

| Variable | Valor |
| --- | --- |
| `POSTGRES_PASSWORD`, `JWT_SECRET`, `COOKIE_SECRET` | Generar al azar (`openssl rand -hex 32`). Distintos entre sí. |
| `MAIL_FROM` | `Cyprotech <no-reply@cyprotech.cl>` (dominio verificado en Resend con SPF y DKIM). |
| `STORE_CORS` | `https://cyprotech.cl` |
| `ADMIN_CORS`, `AUTH_CORS` | `https://cyprotech.cl` |
| `BACKEND_PUBLIC_URL` | `https://cyprotech.cl` |
| `STOREFRONT_URL` | `https://cyprotech.cl` |

Las demás (Intcomex, Flow, OpenFactura, SMTP) tienen valor por defecto seguro y se rellenan cuando lleguen las credenciales: `INTCOMEX_*`, `FLOW_*`, `OPENFACTURA_*`, `BILLING_EMISOR_*`, `SMTP_*`, `MAIL_FROM`, `SUPPORT_EMAIL`, `ALERT_EMAIL`. Marcarlas como secretas en Coolify.

El dominio de `cyprotech.cl` lo da el compose (etiquetas de Traefik). En Coolify el servicio `backend` puede conservar un dominio provisorio como respaldo. Desplegar.

### 2. Preparar la tienda (una sola vez)

Desde la terminal de Coolify del contenedor `backend` (o `docker exec` en el VPS):

```
npx medusa user -e correo@dominio.cl -p CLAVE-LARGA          # administrador
npx medusa exec ./src/scripts/setup-chile.js                  # región Chile, IVA, despacho, categorías
```

`setup-chile` **borra productos, categorías y despachos** para dejar la tienda limpia, por eso se niega a correr si ya existe la región Chile (salvo `SETUP_FORCE=true`).

Después, en el admin (`https://cyprotech.cl/admin`): *Settings → Publishable API Keys* y copiar la clave que ya viene creada (`pk_...`).

### 3. Tienda (aplicación con Dockerfile)

Nuevo recurso → Application → mismo repositorio → *Build Pack: Dockerfile*, ruta `apps/storefront/Dockerfile`, **base directory `/`** (el contexto de build es la raíz). Variables (marcar *Build Variable*):

| Variable | Valor |
| --- | --- |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | `https://cyprotech.cl` |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | la `pk_...` del paso anterior |
| `NEXT_PUBLIC_BASE_URL` | `https://cyprotech.cl` |
| `NEXT_PUBLIC_DEFAULT_REGION` | `cl` |

Puerto 8000. Dominio `https://cyprotech.cl`. Límite de memoria sugerido: 400 MB.

### Cambio de dominio (hecho el 2026-11-04: garage360.cl a cyprotech.cl)

- Cambiaron `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`, `BACKEND_PUBLIC_URL`, `STOREFRONT_URL` (backend) y `NEXT_PUBLIC_MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_BASE_URL` (tienda, hay que reconstruir). Flow arma sus URL de retorno y aviso en cada pago con esas variables, no hay nada que cambiar en su panel.
- Las etiquetas de Traefik no deben llevar el signo `$`: Coolify lo duplica y la expresión deja de coincidir (la redirección de `/admin` dio 502 por eso).
- Las imagenes de productos ya subidas guardan la URL completa del dominio anterior. Antes de retirar `cypro-api.garage360.cl`, en la terminal del contenedor `backend`:
  `NODE_ENV=production npx medusa exec ./src/scripts/rewrite-media-host.js https://cypro-api.garage360.cl https://cyprotech.cl dry-run`
  y, si la lista es la esperada, repetirlo sin `dry-run`.
- `MAIL_FROM` y `SUPPORT_EMAIL` se cambian a `cyprotech.cl` solo cuando el dominio este verificado en Resend (SPF, DKIM, DMARC en Cloudflare).

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

## Despliegue con imágenes de GitHub Actions (rama `optimizar-despliegue`)

Las imágenes se construyen en GitHub y el VPS solo las descarga: no hay compilación en el servidor, ni picos de RAM/CPU, ni caché de builds que crezca en disco.

- `.github/workflows/build-backend.yml` y `build-storefront.yml` se disparan al hacer push a `main` **solo si cambió esa app** (o `packages/`, el lockfile). Publican `ghcr.io/chelotusblvck/cyprotech-backend` y `cyprotech-storefront` con las etiquetas `latest` y el SHA del commit (el SHA sirve para volver atrás).
- Si existen el secreto `COOLIFY_TOKEN` y las variables `COOLIFY_URL` y `COOLIFY_BACKEND_UUID` / `COOLIFY_STOREFRONT_UUID`, el workflow avisa a Coolify al terminar. Si no existen, ese paso se omite y se despliega a mano desde Coolify.

### Pasos de puesta en marcha (una sola vez)

1. **GitHub → Settings → Secrets and variables → Actions → Variables:** `NEXT_PUBLIC_MEDUSA_BACKEND_URL` (`https://cyprotech.cl`), `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` (la `pk_...`), `NEXT_PUBLIC_BASE_URL` (`https://cyprotech.cl`), `NEXT_PUBLIC_DEFAULT_REGION` (`cl`). No son secretas: acaban dentro del JS público de la tienda.
2. Ejecutar a mano los dos workflows (Actions → *Run workflow*) para publicar las primeras imágenes.
3. **Paquetes privados:** en el VPS, `docker login ghcr.io -u chelotusblvck` con un token clásico con permiso `read:packages` (o hacer públicos los paquetes: no contienen secretos, esos entran por variables de Coolify en runtime). Coolify también permite cargar el registro en *Keys & Tokens*.
4. **Tienda en Coolify:** cambiar la aplicación a *Docker Image* `ghcr.io/chelotusblvck/cyprotech-storefront:latest`, puerto 8000, mismo dominio. Las `NEXT_PUBLIC_*` de Coolify ya no hacen falta (van en la imagen).
5. **Backend en Coolify:** el compose ya usa `image:` (variable opcional `BACKEND_IMAGE` para fijar una etiqueta de SHA). Redesplegar.
6. Opcional, para el despliegue automático: token de la API de Coolify (*Keys & Tokens → API tokens*), UUID de cada recurso, y cargarlos como `COOLIFY_TOKEN` (secreto) y `COOLIFY_URL`, `COOLIFY_BACKEND_UUID`, `COOLIFY_STOREFRONT_UUID` (variables). En Coolify, desactivar el *auto deploy* por push para que no compile ni despliegue dos veces.

### Cuidados

- Cambiar `NEXT_PUBLIC_*` obliga a reconstruir la tienda (ejecutar su workflow).
- Revertir: desplegar una etiqueta anterior (`BACKEND_IMAGE=...:<sha>`) o restaurar `build:` en el compose.
- Los `Dockerfile` usan cachés de BuildKit (`--mount=type=cache`) para el store de pnpm y la caché de Next; sirven también si algún día se vuelve a construir en el VPS.
