import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { inviteUrlFor, sendStaffInvite } from "../send"
import { sampleInvite } from "../samples"
import { renderStaffInvite, renderTemplate } from "../templates"

type Invite = { email?: string; token?: string; accepted?: boolean }

const fakeContainer = (invite: Invite | null) => {
  const createNotifications = jest.fn().mockResolvedValue({})
  const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn() }
  const retrieveInvite = jest.fn().mockImplementation(() => (invite ? Promise.resolve(invite) : Promise.reject(new Error("no existe"))))
  const registry: Record<string, unknown> = {
    [ContainerRegistrationKeys.LOGGER]: logger,
    [Modules.NOTIFICATION]: { createNotifications },
    [Modules.USER]: { retrieveInvite },
  }
  const container = { resolve: (key: string) => registry[key] } as unknown as MedusaContainer
  return { container, createNotifications, logger, retrieveInvite }
}

describe("plantilla staff-invite", () => {
  it("lleva el enlace, la vigencia y el aviso de que es personal", () => {
    const email = renderStaffInvite({ inviteUrl: "https://cyprotech.cl/app/invite?token=abc", validDays: 7 })
    expect(email.subject).toBe("Te invitaron al panel de Cyprotech")
    expect(email.html).toContain("https://cyprotech.cl/app/invite?token=abc")
    expect(email.html).toContain("Crear mi clave")
    expect(email.html).toContain("vence en 7 días")
    expect(email.html).toContain("no lo reenvíes")
    expect(email.text).toContain("https://cyprotech.cl/app/invite?token=abc")
  })

  it("escapa el enlace dentro del HTML", () => {
    const email = renderStaffInvite({ inviteUrl: `https://x.cl/?a="><script>` })
    expect(email.html).not.toContain("<script>")
  })

  it("se renderiza por nombre con su muestra", () => {
    expect(renderTemplate("staff-invite", sampleInvite()).html.startsWith("<!doctype html>")).toBe(true)
  })
})

describe("inviteUrlFor", () => {
  const original = process.env.BACKEND_PUBLIC_URL
  afterEach(() => {
    process.env.BACKEND_PUBLIC_URL = original
  })

  it("apunta al admin (/app) del backend público y codifica el token", () => {
    process.env.BACKEND_PUBLIC_URL = "https://cyprotech.cl/"
    expect(inviteUrlFor("a.b+c")).toBe("https://cyprotech.cl/app/invite?token=a.b%2Bc")
  })
})

describe("sendStaffInvite", () => {
  it("envía el correo con el enlace a la persona invitada", async () => {
    const { container, createNotifications } = fakeContainer({ email: "leonardo@cyprotech.cl", token: "tok123" })
    await expect(sendStaffInvite(container, "invite_1")).resolves.toBe(true)
    expect(createNotifications).toHaveBeenCalledTimes(1)
    const sent = createNotifications.mock.calls[0][0]
    expect(sent).toMatchObject({ to: "leonardo@cyprotech.cl", channel: "email", template: "staff-invite" })
    expect(sent.data.inviteUrl).toContain("/app/invite?token=tok123")
  })

  it("no envía nada si la invitación ya fue aceptada", async () => {
    const { container, createNotifications } = fakeContainer({ email: "a@cyprotech.cl", token: "t", accepted: true })
    await expect(sendStaffInvite(container, "invite_1")).resolves.toBe(false)
    expect(createNotifications).not.toHaveBeenCalled()
  })

  it("no envía nada si la invitación no existe", async () => {
    const { container, createNotifications, logger } = fakeContainer(null)
    await expect(sendStaffInvite(container, "invite_x")).resolves.toBe(false)
    expect(createNotifications).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalled()
  })

  it("no revela el token en los registros", async () => {
    const { container, logger } = fakeContainer({ email: "a@cyprotech.cl", token: "SECRETO", accepted: true })
    await sendStaffInvite(container, "invite_1")
    const logged = JSON.stringify([...logger.warn.mock.calls, ...logger.error.mock.calls])
    expect(logged).not.toContain("SECRETO")
  })
})
