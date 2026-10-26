import { capTransferDiscount, isBankConfigured, loadTransferConfig, transferDeadline } from "../config"

describe("loadTransferConfig", () => {
  it("usa 2,5% y 48 horas por defecto", () => {
    const config = loadTransferConfig({})
    expect(config.discountPercent).toBe(2.5)
    expect(config.deadlineHours).toBe(48)
  })

  it("el descuento no puede superar la comision de la pasarela", () => {
    expect(loadTransferConfig({ TRANSFER_DISCOUNT_PERCENT: "5" }).discountPercent).toBe(2.89)
    expect(capTransferDiscount(-1, 2.89)).toBe(0)
  })

  it("exige todos los datos bancarios", () => {
    expect(isBankConfigured(loadTransferConfig({}))).toBe(false)
    expect(
      isBankConfigured(
        loadTransferConfig({
          TRANSFER_BANK_HOLDER: "Garage360 SpA",
          TRANSFER_BANK_RUT: "76.000.000-0",
          TRANSFER_BANK_NAME: "Banco",
          TRANSFER_BANK_ACCOUNT_TYPE: "Cuenta corriente",
          TRANSFER_BANK_ACCOUNT_NUMBER: "123",
          TRANSFER_BANK_EMAIL: "pagos@example.com",
        }),
      ),
    ).toBe(true)
  })
})

describe("transferDeadline", () => {
  it("suma las horas al pedido", () => {
    expect(transferDeadline("2026-10-24T10:00:00Z", 48).toISOString()).toBe("2026-10-26T10:00:00.000Z")
  })
})
