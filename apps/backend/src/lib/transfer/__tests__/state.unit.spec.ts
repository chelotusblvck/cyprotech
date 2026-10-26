import { isAwaitingTransfer, transferStateOf } from "../state"

const order = (providerId: string, capturedAt: string | null, status = "pending") => ({
  status,
  created_at: "2026-10-24T10:00:00Z",
  payment_collections: [{ payments: [{ provider_id: providerId, captured_at: capturedAt }] }],
})

describe("transferStateOf", () => {
  it("transferencia sin capturar queda esperando el pago", () => {
    const state = transferStateOf(order("pp_transfer_transfer", null))
    expect(state).toMatchObject({ isTransfer: true, paid: false })
    expect(isAwaitingTransfer(state)).toBe(true)
  })

  it("transferencia capturada ya no espera", () => {
    const state = transferStateOf(order("pp_transfer_transfer", "2026-10-25T10:00:00Z"))
    expect(isAwaitingTransfer(state)).toBe(false)
  })

  it("un pedido de Flow nunca es transferencia", () => {
    const state = transferStateOf(order("pp_flow_flow", null))
    expect(state.isTransfer).toBe(false)
    expect(isAwaitingTransfer(state)).toBe(false)
  })

  it("un pedido cancelado no espera pago", () => {
    expect(isAwaitingTransfer(transferStateOf(order("pp_transfer_transfer", null, "canceled")))).toBe(false)
  })

  it("sin pedido no hay transferencia", () => {
    expect(isAwaitingTransfer(transferStateOf(undefined))).toBe(false)
  })
})
