import type { Emisor } from "../types"

export type OpenFacturaConfig = {
  apiKey: string
  environment: "dev" | "production"
  baseUrl: string
  timeoutMs: number
}

const BASE_URLS = {
  dev: "https://dev-api.haulmer.com",
  production: "https://api.haulmer.com",
} as const

// Devuelve null mientras no esté la API Key de OpenFactura. En ese caso se usa un emisor simulado
// que genera folios y un PDF de prueba, para ejercitar todo el flujo sin tocar el SII.
export const loadOpenFacturaConfig = (env: NodeJS.ProcessEnv = process.env): OpenFacturaConfig | null => {
  const apiKey = env.OPENFACTURA_API_KEY?.trim()
  if (!apiKey) {
    return null
  }
  const environment = env.OPENFACTURA_ENV === "production" ? "production" : "dev"
  return {
    apiKey,
    environment,
    baseUrl: (env.OPENFACTURA_BASE_URL?.trim() || BASE_URLS[environment]).replace(/\/+$/, ""),
    timeoutMs: Number(env.OPENFACTURA_TIMEOUT_MS) || 60_000,
  }
}

// Datos tributarios de quien vende (Garage360). Faltando cualquiera, no se puede emitir.
export const loadEmisor = (env: NodeJS.ProcessEnv = process.env): Emisor | null => {
  const rut = env.BILLING_EMISOR_RUT?.trim()
  const razonSocial = env.BILLING_EMISOR_RAZON_SOCIAL?.trim()
  const giro = env.BILLING_EMISOR_GIRO?.trim()
  const acteco = Number(env.BILLING_EMISOR_ACTECO)
  const direccion = env.BILLING_EMISOR_DIRECCION?.trim()
  const comuna = env.BILLING_EMISOR_COMUNA?.trim()
  if (!rut || !razonSocial || !giro || !Number.isFinite(acteco) || acteco <= 0 || !direccion || !comuna) {
    return null
  }
  return {
    rut,
    razonSocial,
    giro,
    acteco,
    direccion,
    comuna,
    codigoSucursal: env.BILLING_EMISOR_SUCURSAL?.trim() || undefined,
    correo: env.BILLING_EMISOR_CORREO?.trim() || undefined,
  }
}

// Emisor ficticio para el modo simulado (no se envía a ningún lado).
export const MOCK_EMISOR: Emisor = {
  rut: "76000000-0",
  razonSocial: "Garage360 SpA (simulado)",
  giro: "Venta al por menor por internet",
  acteco: 479100,
  direccion: "Dirección de prueba 123",
  comuna: "Santiago",
}
