import type { MedusaContainer } from "@medusajs/framework/types"

import { sendOrderEmail } from "../../../lib/emails/send"
import { notifyCustomer } from "../orders/status"

jest.mock("../../../lib/emails/send", () => ({ sendOrderEmail: jest.fn() }))

const sendOrder = sendOrderEmail as unknown as jest.Mock
const container = {} as MedusaContainer

const makeOrder = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "icxo_1",
    medusa_order_id: "order_1",
    shipped_notified_at: null,
    delivered_notified_at: null,
    ...overrides,
  }) as never

const makeService = () => ({ updateIntcomexOrders: jest.fn().mockResolvedValue(undefined) }) as never

const shipments = [{ CarrierId: "Starken", FreightShipmentId: "770123" }]

beforeEach(() => sendOrder.mockReset().mockResolvedValue(true))

describe("notifyCustomer", () => {
  it("avisa el despacho con su seguimiento una sola vez", async () => {
    const service = makeService()
    await notifyCustomer(container, service, makeOrder(), 4, shipments)

    expect(sendOrder).toHaveBeenCalledWith(container, "order_1", "order-shipped", {
      tracking: [{ carrier: "Starken", number: "770123", url: null }],
    })
    expect((service as unknown as { updateIntcomexOrders: jest.Mock }).updateIntcomexOrders).toHaveBeenCalledWith(
      expect.objectContaining({ id: "icxo_1", shipped_notified_at: expect.any(Date) }),
    )
  })

  it("no repite el aviso de despacho si ya se envió", async () => {
    await notifyCustomer(container, makeService(), makeOrder({ shipped_notified_at: new Date() }), 5, shipments)
    expect(sendOrder).not.toHaveBeenCalled()
  })

  it("avisa la entrega y la marca", async () => {
    const service = makeService()
    await notifyCustomer(container, service, makeOrder({ shipped_notified_at: new Date() }), 7, shipments)
    expect(sendOrder).toHaveBeenCalledWith(container, "order_1", "order-delivered")
    expect((service as unknown as { updateIntcomexOrders: jest.Mock }).updateIntcomexOrders).toHaveBeenCalledWith(
      expect.objectContaining({ delivered_notified_at: expect.any(Date) }),
    )
  })

  it("al entregarse no manda además el correo de despacho", async () => {
    await notifyCustomer(container, makeService(), makeOrder(), 7, shipments)
    expect(sendOrder).toHaveBeenCalledTimes(1)
    expect(sendOrder.mock.calls[0][2]).toBe("order-delivered")
  })

  it("no avisa nada mientras el pedido sigue en preparación ni cuando se cancela", async () => {
    await notifyCustomer(container, makeService(), makeOrder(), 1, [])
    await notifyCustomer(container, makeService(), makeOrder(), 2, [])
    await notifyCustomer(container, makeService(), makeOrder(), 6, [])
    expect(sendOrder).not.toHaveBeenCalled()
  })

  it("si el correo no pudo salir no marca el aviso, para reintentarlo en la próxima revisión", async () => {
    sendOrder.mockResolvedValue(false)
    const service = makeService()
    await notifyCustomer(container, service, makeOrder(), 4, shipments)
    expect((service as unknown as { updateIntcomexOrders: jest.Mock }).updateIntcomexOrders).not.toHaveBeenCalled()
  })

  it("tolera un seguimiento vacío o mal formado", async () => {
    await notifyCustomer(container, makeService(), makeOrder(), 4, null)
    expect(sendOrder).toHaveBeenCalledWith(container, "order_1", "order-shipped", { tracking: [] })
  })
})
