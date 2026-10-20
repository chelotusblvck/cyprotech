import type { MedusaContainer } from "@medusajs/framework/types"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"

import type { FlowApi, FlowPaymentStatus } from "../client/types"
import { settleFlowPayment } from "../settle"

jest.mock("@medusajs/medusa/core-flows", () => ({
  completeCartWorkflow: jest.fn(),
}))

const complete = completeCartWorkflow as unknown as jest.Mock

const flowStatus = (overrides: Partial<FlowPaymentStatus> = {}): FlowPaymentStatus => ({
  flowOrder: 1,
  commerceOrder: "payses_1",
  status: 2,
  currency: "CLP",
  amount: 1000,
  ...overrides,
})

const apiWith = (status: FlowPaymentStatus) =>
  ({ isMock: true, getPaymentStatus: jest.fn().mockResolvedValue(status) }) as unknown as FlowApi

// Contenedor mínimo: solo entrega la conexión a la base con las filas que se le indiquen.
const containerWith = (options: { session?: object | null; orders?: (string | null)[] }) => {
  const orderResults = [...(options.orders ?? [])]
  const raw = jest.fn(async (sql: string) => {
    if (sql.includes("from payment_session")) {
      return { rows: options.session ? [options.session] : [] }
    }
    const next = orderResults.shift()
    return { rows: next ? [{ order_id: next }] : [] }
  })
  return { resolve: () => ({ raw }) } as unknown as MedusaContainer
}

const session = (data: Record<string, unknown> = {}) => ({
  id: "payses_1",
  cart_id: "cart_1",
  data: { flowToken: "TOK", ...data },
})

beforeEach(() => complete.mockReset())

describe("settleFlowPayment", () => {
  it("devuelve unknown si el pago no corresponde a ninguna sesión", async () => {
    const result = await settleFlowPayment(containerWith({ session: null }), "TOK", apiWith(flowStatus()))
    expect(result).toEqual({ state: "unknown" })
    expect(complete).not.toHaveBeenCalled()
  })

  it("ignora un token antiguo cuando la sesión ya generó una orden de Flow nueva", async () => {
    const result = await settleFlowPayment(
      containerWith({ session: session({ flowToken: "OTRO" }) }),
      "TOK",
      apiWith(flowStatus()),
    )
    expect(result).toEqual({ state: "unknown", cartId: "cart_1" })
    expect(complete).not.toHaveBeenCalled()
  })

  it.each([
    [1, "pending"],
    [3, "rejected"],
    [4, "canceled"],
  ])("estado %s de Flow no completa el carrito (%s)", async (code, state) => {
    const result = await settleFlowPayment(containerWith({ session: session() }), "TOK", apiWith(flowStatus({ status: code })))
    expect(result).toEqual({ state, cartId: "cart_1" })
    expect(complete).not.toHaveBeenCalled()
  })

  it("si el pedido ya existe lo devuelve sin completar el carrito otra vez", async () => {
    const result = await settleFlowPayment(
      containerWith({ session: session(), orders: ["order_1"] }),
      "TOK",
      apiWith(flowStatus()),
    )
    expect(result).toEqual({ state: "paid", cartId: "cart_1", orderId: "order_1" })
    expect(complete).not.toHaveBeenCalled()
  })

  it("con el pago confirmado completa el carrito y devuelve el pedido", async () => {
    complete.mockReturnValue({ run: jest.fn().mockResolvedValue({ result: { id: "order_2" }, errors: [] }) })
    const result = await settleFlowPayment(containerWith({ session: session(), orders: [null] }), "TOK", apiWith(flowStatus()))
    expect(result).toEqual({ state: "paid", cartId: "cart_1", orderId: "order_2" })
    const run = complete.mock.results[0].value.run
    expect(run).toHaveBeenCalledWith({ input: { id: "cart_1" }, throwOnError: false })
  })

  it("un aviso que compite con la tienda devuelve el pedido que ya creó el otro", async () => {
    complete.mockReturnValue({
      run: jest.fn().mockResolvedValue({ result: undefined, errors: [{ error: { message: "ya completado" } }] }),
    })
    const result = await settleFlowPayment(
      containerWith({ session: session(), orders: [null, "order_3"] }),
      "TOK",
      apiWith(flowStatus()),
    )
    expect(result).toEqual({ state: "paid", cartId: "cart_1", orderId: "order_3" })
  })

  it("si no se pudo crear el pedido informa el error y no inventa un pedido", async () => {
    complete.mockReturnValue({
      run: jest.fn().mockResolvedValue({ result: undefined, errors: [{ error: { message: "sin stock" } }] }),
    })
    const result = await settleFlowPayment(
      containerWith({ session: session(), orders: [null, null] }),
      "TOK",
      apiWith(flowStatus()),
    )
    expect(result).toEqual({ state: "paid", cartId: "cart_1", error: "sin stock" })
  })

  it("encuentra la sesión también cuando la orden de Flow es un reintento (id-N)", async () => {
    const api = apiWith(flowStatus({ commerceOrder: "payses_1-2" }))
    const container = containerWith({ session: session(), orders: ["order_4"] })
    const result = await settleFlowPayment(container, "TOK", api)
    expect(result.orderId).toBe("order_4")
    const raw = (container.resolve("pg") as { raw: jest.Mock }).raw
    expect(raw.mock.calls[0][1]).toEqual(["payses_1"])
  })
})
