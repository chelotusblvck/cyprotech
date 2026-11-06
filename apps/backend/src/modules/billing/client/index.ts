import { OpenFacturaClient, OpenFacturaError } from "./client"
import { loadOpenFacturaConfig } from "./config"
import { DteServiceClient, loadDteServiceConfig } from "./dte-service"
import { MockOpenFacturaClient } from "./mock"
import type { OpenFacturaApi } from "./types"

export * from "./types"
export * from "./config"
export { OpenFacturaClient, OpenFacturaError } from "./client"
export { MockOpenFacturaClient } from "./mock"
export { DteServiceClient, loadDteServiceConfig } from "./dte-service"

// El simulado debe ser una sola instancia: guarda los documentos en memoria.
let mock: MockOpenFacturaClient | null = null

// En producción sin API Key nunca se simula: una boleta inventada no existe en el SII y el cliente
// la recibiría por correo. Cada operación falla con un error que no se reintenta sola (una alerta,
// y se reintenta a mano desde el dashboard cuando ya esté la clave).
export class UnconfiguredOpenFacturaClient implements OpenFacturaApi {
  readonly isMock = false

  private error() {
    return new OpenFacturaError(
      "OpenFactura no está configurado en producción (falta OPENFACTURA_API_KEY): no se emite ningún documento.",
      412,
    )
  }

  emit(): Promise<never> {
    return Promise.reject(this.error())
  }

  getStatus(): Promise<never> {
    return Promise.reject(this.error())
  }

  getPdf(): Promise<never> {
    return Promise.reject(this.error())
  }
}

// Proveedor de boletas, por orden: el servicio propio de Garage360 (DTE_SERVICE_URL y DTE_SERVICE_TOKEN), OpenFactura
// (OPENFACTURA_API_KEY) o, solo fuera de producción, un simulado.
export const createOpenFacturaApi = (env: NodeJS.ProcessEnv = process.env): OpenFacturaApi => {
  const dteService = loadDteServiceConfig(env)
  if (dteService) {
    return new DteServiceClient(dteService)
  }
  const config = loadOpenFacturaConfig(env)
  if (config) {
    return new OpenFacturaClient(config)
  }
  if (env.NODE_ENV === "production") {
    return new UnconfiguredOpenFacturaClient()
  }
  mock ??= new MockOpenFacturaClient()
  return mock
}
