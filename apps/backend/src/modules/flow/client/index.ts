import { FlowClient } from "./client"
import { loadFlowConfig } from "./config"
import { MockFlowClient } from "./mock"
import type { FlowApi } from "./types"

export * from "./types"
export * from "./config"
export * from "./signature"
export { FlowClient, FlowError } from "./client"
export { MockFlowClient, simulateFlowResult } from "./mock"

// El cliente simulado debe ser una sola instancia: guarda las órdenes en memoria.
let mock: MockFlowClient | null = null

// Cliente real si hay credenciales (FLOW_API_KEY y FLOW_SECRET_KEY); si no, simulado.
export const createFlowApi = (env: NodeJS.ProcessEnv = process.env): FlowApi => {
  const config = loadFlowConfig(env)
  if (config) {
    return new FlowClient(config)
  }
  mock ??= new MockFlowClient()
  return mock
}
