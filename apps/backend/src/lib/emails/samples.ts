import type { AlertEmailData, DocumentEmailData, OrderEmailData, TemplateName, TransferEmailData } from "./templates"

// Datos de ejemplo para previsualizar los correos (script de vista previa y envío de prueba del dashboard).
export const sampleOrder = (storefrontUrl = "http://localhost:8000"): OrderEmailData => ({
  brand: { storefrontUrl },
  orderNumber: "CY1042",
  customerName: "Ana Pérez",
  createdAt: new Date().toISOString(),
  items: [
    { title: "Tarjeta de video ASUS Dual GeForce RTX 4070 SUPER 12GB GDDR6X", quantity: 1, unitPrice: 744040, total: 744040 },
    { title: "Mouse gamer Logitech G502 X Lightspeed inalámbrico 25K DPI", quantity: 2, unitPrice: 128400, total: 256800 },
    { title: "Teclado mecánico gamer Corsair K70 RGB Pro switch Cherry MX Red", quantity: 1, unitPrice: 153900, total: 153900 },
  ],
  subtotal: 1154740,
  shippingTotal: 2900,
  discountTotal: 0,
  total: 1157640,
  address: {
    name: "Ana Pérez",
    line1: "Av. Providencia 1234",
    line2: "Depto 56",
    city: "Providencia",
    region: "Región Metropolitana de Santiago",
    phone: "+56 9 1234 5678",
  },
  shippingMethod: "Despacho Santiago",
  eta: "2-4 días hábiles",
  paymentMethod: "Flow (tarjeta, débito o transferencia)",
  orderUrl: `${storefrontUrl}/cl/order/order_demo/confirmed`,
  document: null,
  tracking: [{ carrier: "Starken", number: "7701234567", url: "https://www.starken.cl/seguimiento" }],
})

export const sampleTransfer = (storefrontUrl?: string): TransferEmailData => ({
  ...sampleOrder(storefrontUrl),
  paymentMethod: "Transferencia bancaria",
  tracking: [],
  bank: {
    holder: "Garage360 SpA",
    rut: "76.000.000-0",
    bank: "Banco de ejemplo",
    accountType: "Cuenta corriente",
    accountNumber: "000000000",
    email: "pagos@example.com",
  },
  deadline: "26 de octubre",
})

export const sampleDocument = (storefrontUrl = "http://localhost:8000"): DocumentEmailData => ({
  brand: { storefrontUrl },
  orderNumber: "CY1042",
  customerName: "Ana Pérez",
  documentLabel: "Boleta electrónica",
  folio: 109,
  total: 1157640,
  documentUrl: `${storefrontUrl}/documentos/ejemplo`,
  orderUrl: `${storefrontUrl}/cl/order/order_demo/confirmed`,
})

export const sampleAlert = (): AlertEmailData => ({
  title: "La boleta del pedido CY1042 no se pudo emitir",
  message: "OpenFactura rechazó la emisión. El pedido sigue sin documento tributario.",
  details: ["Pedido: CY1042", "Motivo: RUT del receptor inválido", "Intentos: 3"],
  actionLabel: "Abrir el dashboard",
  actionUrl: "http://localhost:9000/app/cyprotech",
})

export const sampleFor = (template: TemplateName, storefrontUrl?: string): unknown => {
  switch (template) {
    case "document-ready":
      return sampleDocument(storefrontUrl)
    case "order-awaiting-transfer":
      return sampleTransfer(storefrontUrl)
    case "internal-alert":
      return sampleAlert()
    default:
      return sampleOrder(storefrontUrl)
  }
}
