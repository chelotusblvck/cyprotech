# Backend Medusa. Contexto de build: la raíz del repositorio (usa pnpm-lock.yaml del workspace).
FROM node:22-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@12.14.0 --activate
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/package.json
RUN pnpm install --frozen-lockfile --filter @cyprotech/backend...

COPY apps/backend apps/backend
WORKDIR /repo/apps/backend
# pnpm se niega a ejecutar si package.json declara npm como gestor.
RUN node -e "const f='package.json',p=require('./'+f);delete p.packageManager;require('fs').writeFileSync(f,JSON.stringify(p,null,2))"
# El build del admin consume memoria; se acota para no ahogar el servidor.
RUN NODE_OPTIONS=--max-old-space-size=1536 pnpm exec medusa build

# El build deja un proyecto autónomo en .medusa/server (con el admin en public/admin).
FROM node:22-bookworm-slim AS run
RUN corepack enable && corepack prepare pnpm@12.14.0 --activate
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/backend/.medusa/server ./
COPY --from=build /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml /repo/.npmrc ./
RUN node -e "const f='package.json',p=require('./'+f);delete p.packageManager;require('fs').writeFileSync(f,JSON.stringify(p,null,2))" && pnpm install --prod --no-frozen-lockfile
COPY apps/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# /app/static guarda los banners subidos desde el admin: se monta como volumen.
RUN mkdir -p /app/static && chmod +x /usr/local/bin/docker-entrypoint.sh && chown -R node:node /app
USER node
EXPOSE 9000
ENTRYPOINT ["docker-entrypoint.sh"]
