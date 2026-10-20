import type {
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types"
import { AbstractNotificationProviderService, MedusaError } from "@medusajs/framework/utils"
import nodemailer, { type Transporter } from "nodemailer"

import { isTemplateName, renderTemplate } from "../../lib/emails/templates"
import { loadSmtpConfig, type SmtpConfig } from "./config"

type Options = Record<string, unknown>

// Proveedor de correo (canal "email") por SMTP. Renderiza las plantillas de src/lib/emails y las
// envía con nodemailer. Funciona con cualquier servicio SMTP (Zoho, Google Workspace, Resend,
// Amazon SES, Mailgun...) y en desarrollo con Mailpit.
class SmtpNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "smtp"

  protected config: SmtpConfig | null
  protected transport: Transporter | null = null

  constructor(_container: Record<string, unknown>, _options: Options) {
    super()
    this.config = loadSmtpConfig()
  }

  private getTransport() {
    if (!this.config) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "El correo no está configurado: falta SMTP_HOST en el entorno de producción.",
      )
    }
    this.transport ??= nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.user ? { user: this.config.user, pass: this.config.password } : undefined,
    })
    return this.transport
  }

  async send(notification: ProviderSendNotificationDTO): Promise<ProviderSendNotificationResultsDTO> {
    if (!isTemplateName(notification.template)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `La plantilla de correo "${notification.template}" no existe.`,
      )
    }

    const { subject, html, text } = renderTemplate(notification.template, notification.data ?? {})
    const info = await this.getTransport().sendMail({
      from: notification.from || this.config?.from,
      to: notification.to,
      subject,
      html,
      text,
      attachments: (notification.attachments ?? []).map((file) => ({
        filename: file.filename,
        content: Buffer.from(file.content, "base64"),
        contentType: file.content_type,
      })),
    })
    return { id: info.messageId }
  }
}

export default SmtpNotificationProviderService
