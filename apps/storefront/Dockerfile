# Tienda Next.js. Contexto de build: la raíz del repositorio.
# Las variables NEXT_PUBLIC_* se incrustan al compilar: llegan como build args (Coolify las pasa solo).
FROM node:22-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@12.14.0 --activate
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/storefront/package.json apps/storefront/package.json
RUN pnpm install --frozen-lockfile --filter @cyprotech/storefront...

COPY apps/storefront apps/storefront
WORKDIR /repo/apps/storefront
RUN node -e "const f='package.json',p=require('./'+f);delete p.packageManager;require('fs').writeFileSync(f,JSON.stringify(p,null,2))"

ARG NEXT_PUBLIC_MEDUSA_BACKEND_URL
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_DEFAULT_REGION=cl
ENV NEXT_PUBLIC_MEDUSA_BACKEND_URL=$NEXT_PUBLIC_MEDUSA_BACKEND_URL \
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY \
    NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_DEFAULT_REGION=$NEXT_PUBLIC_DEFAULT_REGION \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
RUN NODE_OPTIONS=--max-old-space-size=1536 pnpm exec next build

FROM node:22-bookworm-slim AS run
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8000 HOSTNAME=0.0.0.0
WORKDIR /app
# El modo standalone conserva la estructura del workspace dentro de apps/storefront.
COPY --from=build /repo/apps/storefront/.next/standalone ./
COPY --from=build /repo/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=build /repo/apps/storefront/public ./apps/storefront/public
# Next escribe su caché de renderizado dentro de .next.
RUN mkdir -p apps/storefront/.next/cache && chown -R node:node apps/storefront/.next
USER node
EXPOSE 8000
CMD ["node", "apps/storefront/server.js"]
