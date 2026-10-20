import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { brandOverrides, sendEmail } from "../lib/emails/send"
import { sampleFor } from "../lib/emails/samples"
import { TEMPLATES, type TemplateName } from "../lib/emails/templates"

// Envía un ejemplo de cada correo a una casilla para revisarlos (en local, Mailpit: http://localhost:8025).
// Uso: npx medusa exec ./src/scripts/dev-preview-emails.ts tu@correo.cl
export default async function devPreviewEmails({ container, args = [] }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const to = args[0] ?? "vista.previa@example.com"
  const { storefrontUrl } = brandOverrides()

  for (const template of Object.keys(TEMPLATES) as TemplateName[]) {
    const ok = await sendEmail(container, { to, template, data: sampleFor(template, storefrontUrl) })
    logger.info(`Correo "${template}" -> ${to}: ${ok ? "enviado" : "falló"}`)
  }
}
