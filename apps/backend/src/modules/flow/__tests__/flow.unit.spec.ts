import { createHmac } from "crypto"

import { FlowClient } from "../client/client"
import { loadFlowConfig, loadFlowUrls } from "../client/config"
import { createFlowApi } from "../client"
import { simulateFlowResult } from "../client/mock"
import { buildSigningString, sign, withSignature } from "../client/signature"
import { FLOW_STATUS } from "../client/types"
import {
  applyFlowStatus,
  commerceOrderFor,
  mapFlowStatus,
  sessionIdFrom,
  toAmount,
} from "../payment-data"
import FlowPaymentProviderService from "../provider"

const config = {
  apiKey: "KEY-1",
  secretKey: "SECRET-1",
  environment: "sandbox" as const,
  baseUrl: "https://sandbox.flow.cl/api",
  backendUrl: "https://api.cyprotech.cl",
  storefrontUrl: "https://cyprotech.cl",
  paymentMethod: 9,
  orderTimeoutSeconds: 7200,
  timeoutMs: 1000,
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

describe("firma", () => {
  it("ordena por nombre y concatena nombre + valor (ejemplo de la documentación)", () => {
    expect(buildSigningString({ apiKey: "XXXX-XXXX-XXXX", currency: "CLP", amount: 5000 })).toBe(
      "amount5000apiKeyXXXX-XXXX-XXXXcurrencyCLP",
    )
  })

  it("ignora el parámetro s y los valores vacíos", () => {
    expect(buildSigningString({ b: "2", a: "1", s: "firma", c: undefined, d: null })).toBe("a1b2")
  })

  it("firma con HMAC-SHA256 y la secretKey", () => {
    const expected = createHmac("sha256", "secret").update("amount5000apiKeyXcurrencyCLP").digest("hex")
    expect(sign({ apiKey: "X", currency: "CLP", amount: 5000 }, "secret")).toBe(expected)
    expect(expected).toMatch(/^[0-9a-f]{64}$/)
  })

  it("withSignature agrega s sin alterar los demás parámetros", () => {
    const result = withSignature({ apiKey: "X", amount: 1 }, "secret")
    expect(result).toMatchObject({ apiKey: "X", amount: 1 })
    expect(result.s).toBe(sign({ apiKey: "X", amount: 1 }, "secret"))
  })
})

describe("configuración", () => {
  it("sin credenciales no hay configuración real", () => {
    expect(loadFlowConfig({} as NodeJS.ProcessEnv)).toBeNull()
    expect(loadFlowConfig({ FLOW_API_KEY: "a" } as unknown as NodeJS.ProcessEnv)).toBeNull()
    expect(createFlowApi({} as NodeJS.ProcessEnv).isMock).toBe(true)
  })

  it("usa sandbox por defecto y producción solo si se pide", () => {
    const base = { FLOW_API_KEY: "a", FLOW_SECRET_KEY: "b" }
    expect(loadFlowConfig(base as unknown as NodeJS.ProcessEnv)?.baseUrl).toBe("https://sandbox.flow.cl/api")
    expect(loadFlowConfig({ ...base, FLOW_ENV: "production" } as unknown as NodeJS.ProcessEnv)?.baseUrl).toBe(
      "https://www.flow.cl/api",
    )
    expect(createFlowApi(base as unknown as NodeJS.ProcessEnv).isMock).toBe(false)
  })

  it("quita la barra final de las URLs públicas", () => {
    const urls = loadFlowUrls({
      BACKEND_PUBLIC_URL: "https://api.cyprotech.cl/",
      STOREFRONT_URL: "https://cyprotech.cl//",
    } as unknown as NodeJS.ProcessEnv)
    expect(urls).toEqual({ backendUrl: "https://api.cyprotech.cl", storefrontUrl: "https://cyprotech.cl" })
  })
})

describe("FlowClient", () => {
  it("crea la orden con POST form-urlencoded firmado", async () => {
    const fetchMock = jest.fn().mockResolvedValue(json({ url: "https://flow.cl/pay", token: "TOK", flowOrder: 7 }))
    const client = new FlowClient(config, fetchMock as unknown as typeof fetch)

    const result = await client.createPayment({
      commerceOrder: "payses_1",
      subject: "Pedido",
      currency: "CLP",
      amount: 5000,
      email: "a@b.cl",
      urlConfirmation: "https://api.cyprotech.cl/hooks/flow/confirm",
      urlReturn: "https://cyprotech.cl/api/flow/return",
      optional: { session: "payses_1" },
    })

    expect(result.token).toBe("TOK")
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://sandbox.flow.cl/api/payment/create")
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded")
    const body = new URLSearchParams(init.body)
    expect(body.get("apiKey")).toBe("KEY-1")
    expect(body.get("amount")).toBe("5000")
    expect(body.get("optional")).toBe('{"session":"payses_1"}')
    expect(body.has("timeout")).toBe(false)

    // La firma corresponde a todos los parámetros enviados, sin incluir a "s".
    const sent = Object.fromEntries(body.entries())
    const { s, ...rest } = sent
    expect(s).toBe(sign(rest, "SECRET-1"))
  })

  it("consulta el estado con GET firmado", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(json({ flowOrder: 7, commerceOrder: "payses_1", status: 2, currency: "CLP", amount: 5000 }))
    const status = await new FlowClient(config, fetchMock as unknown as typeof fetch).getPaymentStatus("TOK")

    expect(status.status).toBe(2)
    const [url, init] = fetchMock.mock.calls[0]
    expect(init).toEqual({ signal: expect.anything() })
    const parsed = new URL(url)
    expect(parsed.pathname).toBe("/api/payment/getStatus")
    const params = Object.fromEntries(parsed.searchParams.entries())
    const { s, ...rest } = params
    expect(rest).toEqual({ apiKey: "KEY-1", token: "TOK" })
    expect(s).toBe(sign(rest, "SECRET-1"))
  })

  it("convierte el error de Flow en una excepción con su código", async () => {
    const fetchMock = jest.fn().mockResolvedValue(json({ code: 105, message: "commerceOrder duplicada" }, 400))
    await expect(
      new FlowClient(config, fetchMock as unknown as typeof fetch).getPaymentStatus("TOK"),
    ).rejects.toMatchObject({ message: "commerceOrder duplicada", flowCode: 105 })
  })
})

describe("datos de pago", () => {
  it.each([
    [FLOW_STATUS.PENDING, "pending"],
    [FLOW_STATUS.PAID, "captured"],
    [FLOW_STATUS.REJECTED, "error"],
    [FLOW_STATUS.CANCELED, "canceled"],
    [99, "pending"],
  ])("estado %s de Flow -> %s", (flow, expected) => {
    expect(mapFlowStatus(flow)).toBe(expected)
  })

  it("arma y separa el número de orden", () => {
    expect(commerceOrderFor("payses_01ABC", 0)).toBe("payses_01ABC")
    expect(commerceOrderFor("payses_01ABC", 2)).toBe("payses_01ABC-2")
    expect(sessionIdFrom("payses_01ABC-2")).toBe("payses_01ABC")
    expect(sessionIdFrom("payses_01ABC")).toBe("payses_01ABC")
  })

  it("lee montos de números, textos y BigNumber", () => {
    expect(toAmount(1000)).toBe(1000)
    expect(toAmount("1500")).toBe(1500)
    expect(toAmount({ numeric: 2500 })).toBe(2500)
  })

  it("guarda la comisión real que informa Flow", () => {
    const data = applyFlowStatus(
      { sessionId: "s", commerceOrder: "s", attempt: 0, flowToken: "T", flowOrder: 1, redirectUrl: "u", amount: 1000, currency: "CLP", email: "a@b.cl" },
      {
        flowOrder: 1,
        commerceOrder: "s",
        status: 2,
        currency: "CLP",
        amount: 1000,
        paymentData: { amount: 1000, fee: 29, balance: 971, media: "Webpay", date: "2026-10-20 10:00:00" },
      },
    )
    expect(data).toMatchObject({ flowStatus: 2, flowFee: 29, flowBalance: 971, flowMedia: "Webpay" })
  })
})

describe("proveedor de pagos (con el Flow simulado)", () => {
  const provider = () => new FlowPaymentProviderService({}, {})
  const start = (id: string, amount = 100000) =>
    provider().initiatePayment({
      amount,
      currency_code: "clp",
      data: { email: "cliente@example.com" },
      context: { idempotency_key: id },
    })

  it("crea la orden de Flow y entrega la URL de pago", async () => {
    const result = await start("payses_A")
    const data = result.data as Record<string, unknown>
    expect(result.status).toBe("pending")
    expect(data.commerceOrder).toBe("payses_A")
    expect(data.redirectUrl).toMatch(/\/api\/flow\/sandbox\?token=[0-9A-F]+$/)
    expect(data.amount).toBe(100000)
  })

  it("exige el correo del pagador y un monto válido", async () => {
    await expect(
      provider().initiatePayment({ amount: 1000, currency_code: "clp", context: { idempotency_key: "x" } }),
    ).rejects.toThrow(/correo/)
    await expect(
      provider().initiatePayment({ amount: 0, currency_code: "clp", data: { email: "a@b.cl" } }),
    ).rejects.toThrow(/Monto inválido/)
  })

  it("no autoriza un pago pendiente", async () => {
    const { data } = await start("payses_B")
    const result = await provider().authorizePayment({ data })
    expect(result.status).toBe("pending")
  })

  it("autoriza y captura el pago cuando Flow lo confirma, guardando la comisión real", async () => {
    const { data } = await start("payses_C", 200000)
    simulateFlowResult((data as { flowToken: string }).flowToken, "paid")

    const result = await provider().authorizePayment({ data })
    expect(result.status).toBe("captured")
    expect(result.data).toMatchObject({ flowStatus: 2, flowFee: 5780, flowBalance: 194220, flowMedia: "Simulado" })
    // La captura no hace nada más: Flow ya cobró.
    expect(await provider().capturePayment({ data: result.data })).toEqual({ data: result.data })
  })

  it("rechazado o cancelado no se autoriza", async () => {
    const { data } = await start("payses_D")
    simulateFlowResult((data as { flowToken: string }).flowToken, "rejected")
    expect((await provider().authorizePayment({ data })).status).toBe("error")

    const second = await start("payses_E")
    simulateFlowResult((second.data as { flowToken: string }).flowToken, "canceled")
    expect((await provider().getPaymentStatus({ data: second.data })).status).toBe("canceled")
  })

  it("crea una orden nueva cuando cambia el monto del carrito y conserva la misma si no cambia", async () => {
    const { data } = await start("payses_F", 100000)
    const same = await provider().updatePayment({ amount: 100000, currency_code: "clp", data })
    expect((same.data as { flowToken: string }).flowToken).toBe((data as { flowToken: string }).flowToken)

    const changed = await provider().updatePayment({ amount: 120000, currency_code: "clp", data })
    const next = changed.data as { flowToken: string; commerceOrder: string; attempt: number; amount: number }
    expect(next.flowToken).not.toBe((data as { flowToken: string }).flowToken)
    expect(next.commerceOrder).toBe("payses_F-1")
    expect(next.attempt).toBe(1)
    expect(next.amount).toBe(120000)
  })

  it("registra la solicitud de reembolso", async () => {
    const { data } = await start("payses_G", 50000)
    simulateFlowResult((data as { flowToken: string }).flowToken, "paid")
    const paid = await provider().authorizePayment({ data })

    const refunded = await provider().refundPayment({ amount: 20000, data: paid.data })
    const refunds = (refunded.data as { refunds: { amount: number; status: string }[] }).refunds
    expect(refunds).toHaveLength(1)
    expect(refunds[0]).toMatchObject({ amount: 20000, status: "created" })
  })

  it("falla con una sesión que no tiene orden de Flow", async () => {
    await expect(provider().authorizePayment({ data: {} })).rejects.toThrow(/orden de Flow/)
  })

  it("no usa el webhook genérico de Medusa", async () => {
    expect(await provider().getWebhookActionAndData({ data: {}, rawData: "", headers: {} })).toEqual({
      action: "not_supported",
    })
  })
})
