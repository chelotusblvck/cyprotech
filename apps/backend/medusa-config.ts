import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },
  modules: [
    {
      resolve: "./src/modules/intcomex",
    },
    {
      resolve: "./src/modules/ledger",
    },
    {
      resolve: "./src/modules/billing",
    },
    {
      resolve: "./src/modules/news",
    },
    {
      // Banners de Novedades subidos desde el admin. En producción /app/static va en un volumen.
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-local",
            id: "local",
            options: {
              backend_url: `${process.env.BACKEND_PUBLIC_URL || "http://localhost:9000"}/static`,
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          // Correo por SMTP (Mailpit en desarrollo). Canal "email".
          {
            resolve: "./src/modules/notification-smtp",
            id: "smtp",
            options: { channels: ["email"] },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          // Flow (Chile). El proveedor queda disponible como pp_flow_flow.
          { resolve: "./src/modules/flow", id: "flow" },
          // Transferencia directa. El proveedor queda disponible como pp_transfer_transfer.
          { resolve: "./src/modules/transfer", id: "transfer" },
        ],
      },
    },
    {
      resolve: '@medusajs/medusa/event-bus-redis',
      options: { redisUrl: process.env.REDIS_URL },
    },
    {
      resolve: '@medusajs/medusa/workflow-engine-redis',
      options: { redis: { redisUrl: process.env.REDIS_URL } },
    },
  ],
})
