export type IntcomexConfig = {
  apiKey: string
  accessKey: string
  environment: "test" | "production"
  baseUrl: string
  locale: string
  timeoutMs: number
  maxRetries: number
}

const BASE_URLS = {
  test: "https://intcomex-test.apigee.net/v1/",
  production: "https://intcomex-prod.apigee.net/v1/",
} as const

// Devuelve null mientras no estén cargadas las credenciales. En ese caso el sistema usa
// el cliente simulado, así el desarrollo local funciona sin llamar a Intcomex.
export const loadIntcomexConfig = (env: NodeJS.ProcessEnv = process.env): IntcomexConfig | null => {
  const apiKey = env.INTCOMEX_API_KEY?.trim()
  const accessKey = env.INTCOMEX_ACCESS_KEY?.trim()
  if (!apiKey || !accessKey) {
    return null
  }

  const environment = env.INTCOMEX_ENV === "production" ? "production" : "test"
  return {
    apiKey,
    accessKey,
    environment,
    baseUrl: env.INTCOMEX_BASE_URL?.trim() || BASE_URLS[environment],
    locale: env.INTCOMEX_LOCALE?.trim() || "es",
    timeoutMs: Number(env.INTCOMEX_TIMEOUT_MS) || 180_000,
    maxRetries: Number(env.INTCOMEX_MAX_RETRIES) || 3,
  }
}
