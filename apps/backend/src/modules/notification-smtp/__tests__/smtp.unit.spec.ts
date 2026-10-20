import { sampleOrder } from "../../../lib/emails/samples"
import { loadSmtpConfig } from "../config"

const sendMail = jest.fn()
const createTransport = jest.fn(() => ({ sendMail }))

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: { createTransport: (...args: unknown[]) => (createTransport as unknown as (...a: unknown[]) => unknown)(...args) },
}))

// eslint-disable-next-line import/first
import SmtpNotificationProviderService from "../service"

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv

describe("loadSmtpConfig", () => {
  it("en desarrollo sin SMTP_HOST usa Mailpit en 127.0.0.1:1025", () => {
    expect(loadSmtpConfig(env({}))).toMatchObject({ host: "127.0.0.1", port: 1025, secure: false })
  })

  it("en producción sin SMTP_HOST no hay configuración (no se envía nada)", () => {
    expect(loadSmtpConfig(env({ NODE_ENV: "production" }))).toBeNull()
  })

  it("con host usa 587 por defecto y TLS directo en 465", () => {
    expect(loadSmtpConfig(env({ SMTP_HOST: "smtp.example.com" }))).toMatchObject({ port: 587, secure: false })
    expect(loadSmtpConfig(env({ SMTP_HOST: "smtp.example.com", SMTP_PORT: "465" }))).toMatchObject({ port: 465, secure: true })
  })

  it("lee usuario, contraseña y remitente", () => {
    const config = loadSmtpConfig(
      env({ SMTP_HOST: "h", SMTP_USER: "u", SMTP_PASSWORD: "p", MAIL_FROM: "Tienda <t@x.cl>" }),
    )
    expect(config).toMatchObject({ user: "u", password: "p", from: "Tienda <t@x.cl>" })
    expect(loadSmtpConfig(env({}))?.from).toBe("Cyprotech <no-reply@cyprotech.cl>")
  })
})

describe("SmtpNotificationProviderService", () => {
  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue({ messageId: "<abc@mail>" })
    createTransport.mockClear()
  })

  const provider = () => new SmtpNotificationProviderService({}, {})
  const base = { to: "ana@example.com", channel: "email", template: "order-confirmed" }

  it("renderiza la plantilla y envía asunto, HTML y texto al destinatario", async () => {
    const result = await provider().send({ ...base, data: { ...sampleOrder() } })
    expect(result).toEqual({ id: "<abc@mail>" })
    const mail = sendMail.mock.calls[0][0]
    expect(mail.to).toBe("ana@example.com")
    expect(mail.subject).toBe("Pedido CY1042 confirmado")
    expect(mail.html).toContain("$1.157.640")
    expect(mail.text).toContain("CY1042")
    expect(mail.from).toBe("Cyprotech <no-reply@cyprotech.cl>")
  })

  it("convierte los adjuntos de base64 a archivo", async () => {
    await provider().send({
      ...base,
      template: "internal-alert",
      data: { title: "t", message: "m" },
      attachments: [{ filename: "boleta.pdf", content: Buffer.from("%PDF-demo").toString("base64"), content_type: "application/pdf" }],
    })
    const [attachment] = sendMail.mock.calls[0][0].attachments
    expect(attachment.filename).toBe("boleta.pdf")
    expect(attachment.content.toString()).toBe("%PDF-demo")
    expect(attachment.contentType).toBe("application/pdf")
  })

  it("rechaza una plantilla que no existe sin intentar enviar", async () => {
    await expect(provider().send({ ...base, template: "inventada", data: {} })).rejects.toThrow(/no existe/)
    expect(sendMail).not.toHaveBeenCalled()
  })

  it("reutiliza una sola conexión SMTP entre envíos", async () => {
    const instance = provider()
    const data = { title: "t", message: "m" }
    await instance.send({ ...base, template: "internal-alert", data })
    await instance.send({ ...base, template: "internal-alert", data })
    expect(createTransport).toHaveBeenCalledTimes(1)
  })

  it("propaga el error cuando el servidor SMTP falla, para que quede registrado", async () => {
    sendMail.mockRejectedValue(new Error("connect ECONNREFUSED"))
    await expect(provider().send({ ...base, template: "internal-alert", data: { title: "t", message: "m" } })).rejects.toThrow(
      /ECONNREFUSED/,
    )
  })
})
