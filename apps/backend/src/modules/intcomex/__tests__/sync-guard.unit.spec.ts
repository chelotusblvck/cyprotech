import { MockIntcomexClient } from "../client"
import { assertSyncAllowed } from "../sync/run"

describe("assertSyncAllowed", () => {
  const mock = new MockIntcomexClient()
  const real = { isMock: false } as never

  it("en producción no deja sincronizar el catálogo simulado", () => {
    expect(() => assertSyncAllowed(mock, { NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(/INTCOMEX_API_KEY/)
  })

  it("fuera de producción el simulado sirve para probar el ciclo", () => {
    expect(() => assertSyncAllowed(mock, { NODE_ENV: "development" } as NodeJS.ProcessEnv)).not.toThrow()
    expect(() => assertSyncAllowed(mock, {} as NodeJS.ProcessEnv)).not.toThrow()
  })

  it("con el cliente real en producción sincroniza", () => {
    expect(() => assertSyncAllowed(real, { NODE_ENV: "production" } as NodeJS.ProcessEnv)).not.toThrow()
  })
})
