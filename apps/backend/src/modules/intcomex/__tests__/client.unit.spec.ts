import { createHash } from "crypto"

import { IntcomexClient, IntcomexError } from "../client/client"
import { loadIntcomexConfig } from "../client/config"
import { createIntcomexApi } from "../client"
import { buildAuthorizationHeader, buildSignature, formatUtcTimestamp } from "../client/signature"

const config = {
  apiKey: "KEY-123",
  accessKey: "SECRET-456",
  environment: "test" as const,
  baseUrl: "https://intcomex-test.apigee.net/v1/",
  locale: "es",
  timeoutMs: 1000,
  maxRetries: 2,
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

describe("firma", () => {
  it("formatea el timestamp UTC sin milisegundos", () => {
    expect(formatUtcTimestamp(new Date("2026-10-20T15:06:18.789Z"))).toBe("2026-10-20T15:06:18Z")
  })

  it("firma con SHA-256 de apiKey,accessKey,timestamp", () => {
    const expected = createHash("sha256")
      .update("KEY-123,SECRET-456,2026-10-20T15:06:18Z")
      .digest("hex")
    expect(buildSignature("KEY-123", "SECRET-456", "2026-10-20T15:06:18Z")).toBe(expected)
    expect(expected).toMatch(/^[0-9a-f]{64}$/)
  })

  it("arma el header Bearer sin exponer la access key", () => {
    const header = buildAuthorizationHeader("KEY-123", "SECRET-456", new Date("2026-10-20T15:06:18Z"))
    expect(header).toMatch(
      /^Bearer apiKey=KEY-123&utcTimeStamp=2026-10-20T15:06:18Z&signature=[0-9a-f]{64}$/,
    )
    expect(header).not.toContain("SECRET-456")
  })
})

describe("loadIntcomexConfig", () => {
  it("devuelve null sin credenciales", () => {
    expect(loadIntcomexConfig({} as NodeJS.ProcessEnv)).toBeNull()
    expect(loadIntcomexConfig({ INTCOMEX_API_KEY: "a" } as unknown as NodeJS.ProcessEnv)).toBeNull()
  })

  it("usa el ambiente de pruebas por defecto y producción solo si se pide", () => {
    const base = { INTCOMEX_API_KEY: "a", INTCOMEX_ACCESS_KEY: "b" }
    expect(loadIntcomexConfig(base as unknown as NodeJS.ProcessEnv)?.baseUrl).toContain("intcomex-test")
    expect(
      loadIntcomexConfig({ ...base, INTCOMEX_ENV: "production" } as unknown as NodeJS.ProcessEnv)
        ?.baseUrl,
    ).toContain("intcomex-prod")
  })

  it("createIntcomexApi cae al cliente simulado sin credenciales", () => {
    expect(createIntcomexApi({} as NodeJS.ProcessEnv).isMock).toBe(true)
    expect(
      createIntcomexApi({ INTCOMEX_API_KEY: "a", INTCOMEX_ACCESS_KEY: "b" } as unknown as NodeJS.ProcessEnv)
        .isMock,
    ).toBe(false)
  })
})

describe("IntcomexClient", () => {
  it("llama a la URL correcta con autorización y locale", async () => {
    const fetchMock = jest.fn().mockResolvedValue(json([]))
    await new IntcomexClient(config, fetchMock as unknown as typeof fetch).getCatalog()

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://intcomex-test.apigee.net/v1/getcatalog?locale=es")
    expect(init.method).toBe("GET")
    expect(init.headers.Authorization).toMatch(/^Bearer apiKey=KEY-123&utcTimeStamp=/)
  })

  it("envía placeorder como POST con el número de orden del cliente", async () => {
    const fetchMock = jest.fn().mockResolvedValue(json({ OrderNumber: "601444" }))
    const order = { CustomerOrderNumber: "CY1001", Items: [{ Sku: "S1", Quantity: 2 }] }
    const result = await new IntcomexClient(config, fetchMock as unknown as typeof fetch).placeOrder(
      order,
    )

    const [url, init] = fetchMock.mock.calls[0]
    expect(result.OrderNumber).toBe("601444")
    expect(url).toContain("placeorder")
    expect(url).toContain("customerOrderNumber=CY1001")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual(order)
  })

  it("convierte el error de IWS en IntcomexError con código y referencia", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(json({ Message: "IP address not registered.", ErrorCode: 14, Reference: "abc" }, 401))

    await expect(
      new IntcomexClient(config, fetchMock as unknown as typeof fetch).getInventory(),
    ).rejects.toMatchObject({
      name: "IntcomexError",
      status: 401,
      errorCode: 14,
      reference: "abc",
      message: "IP address not registered.",
    })
    // 401 no se reintenta.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("reintenta ante 429 y luego tiene éxito", async () => {
    jest.useFakeTimers()
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(json({ Message: "slow down" }, 429))
      .mockResolvedValueOnce(json([{ UnitPrice: 1, CurrencyId: "US" }]))

    const promise = new IntcomexClient(config, fetchMock as unknown as typeof fetch).getPriceList()
    await jest.advanceTimersByTimeAsync(2000)
    await expect(promise).resolves.toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    jest.useRealTimers()
  })

  it("getProduct devuelve null si el SKU no existe", async () => {
    const fetchMock = jest.fn().mockResolvedValue(json({ Message: "not found" }, 404))
    const result = await new IntcomexClient(config, fetchMock as unknown as typeof fetch).getProduct(
      "NOPE",
    )
    expect(result).toBeNull()
  })

  it("expone IntcomexError como clase", () => {
    expect(new IntcomexError("x", 500)).toBeInstanceOf(Error)
  })
})
