import { IntcomexClient } from "./client"
import { loadIntcomexConfig } from "./config"
import { MockIntcomexClient } from "./mock"
import type { IntcomexApi } from "./types"

export * from "./types"
export * from "./config"
export * from "./signature"
export { IntcomexClient, IntcomexError } from "./client"
export { MockIntcomexClient } from "./mock"

// Cliente real si hay credenciales (INTCOMEX_API_KEY e INTCOMEX_ACCESS_KEY); si no, simulado.
export const createIntcomexApi = (env: NodeJS.ProcessEnv = process.env): IntcomexApi => {
  const config = loadIntcomexConfig(env)
  return config ? new IntcomexClient(config) : new MockIntcomexClient()
}
