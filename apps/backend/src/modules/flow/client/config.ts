export type FlowConfig = {
  apiKey: string
  secretKey: string
  environment: "sandbox" | "production"
  baseUrl: string
  // URL pública del backend: Flow la usa para confirmar los pagos (urlConfirmation).
  backendUrl: string
  // URL pública de la tienda: Flow devuelve al cliente aquí (urlReturn).
  storefrontUrl: string
  // Medio de pago (9 = todos).
  paymentMethod: number
  // Segundos que una orden de pago sigue vigente.
  orderTimeoutSeconds: number
  timeoutMs: number
}

const BASE_URLS = {
  sandbox: "https://sandbox.flow.cl/api",
  production: "https://www.flow.cl/api",
} as const

const strip = (value: string) => value.replace(/\/+$/, "")

export type FlowUrls = { backendUrl: string; storefrontUrl: string }

export const loadFlowUrls = (env: NodeJS.ProcessEnv = process.env): FlowUrls => ({
  backendUrl: strip(env.BACKEND_PUBLIC_URL?.trim() || "http://localhost:9000"),
  storefrontUrl: strip(env.STOREFRONT_URL?.trim() || "http://localhost:8000"),
})

// Devuelve null mientras no estén las credenciales de Flow. En ese caso se usa el simulador
// local, para poder probar el flujo completo sin cobrar ni llamar a Flow.
export const loadFlowConfig = (env: NodeJS.ProcessEnv = process.env): FlowConfig | null => {
  const apiKey = env.FLOW_API_KEY?.trim()
  const secretKey = env.FLOW_SECRET_KEY?.trim()
  if (!apiKey || !secretKey) {
    return null
  }

  const environment = env.FLOW_ENV === "production" ? "production" : "sandbox"
  return {
    apiKey,
    secretKey,
    environment,
    baseUrl: strip(env.FLOW_BASE_URL?.trim() || BASE_URLS[environment]),
    ...loadFlowUrls(env),
    paymentMethod: Number(env.FLOW_PAYMENT_METHOD) || 9,
    orderTimeoutSeconds: Number(env.FLOW_ORDER_TIMEOUT_SECONDS) || 7200,
    timeoutMs: Number(env.FLOW_TIMEOUT_MS) || 30_000,
  }
}
