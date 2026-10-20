import { OpenFacturaClient } from "./client"
import { loadOpenFacturaConfig } from "./config"
import { MockOpenFacturaClient } from "./mock"
import type { OpenFacturaApi } from "./types"

export * from "./types"
export * from "./config"
export { OpenFacturaClient, OpenFacturaError } from "./client"
export { MockOpenFacturaClient } from "./mock"

// El simulado debe ser una sola instancia: guarda los documentos en memoria.
let mock: MockOpenFacturaClient | null = null

// Cliente real si hay API Key (OPENFACTURA_API_KEY); si no, simulado.
export const createOpenFacturaApi = (env: NodeJS.ProcessEnv = process.env): OpenFacturaApi => {
  const config = loadOpenFacturaConfig(env)
  if (config) {
    return new OpenFacturaClient(config)
  }
  mock ??= new MockOpenFacturaClient()
  return mock
}
