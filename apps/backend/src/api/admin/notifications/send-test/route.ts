import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import { sampleFor } from "../../../../lib/emails/samples"
import { brandOverrides, sendEmail } from "../../../../lib/emails/send"
import { TEMPLATES, type TemplateName } from "../../../../lib/emails/templates"

const bodySchema = z.object({
  to: z.string().email(),
  template: z.enum(Object.keys(TEMPLATES) as [TemplateName, ...TemplateName[]]).default("order-confirmed"),
})

// Envía un correo de ejemplo para comprobar que el SMTP y el diseño funcionan. Usa datos de muestra.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "Indica un correo válido y una plantilla existente." })
    return
  }
  const { to, template } = parsed.data
  const sent = await sendEmail(req.scope, { to, template, data: sampleFor(template, brandOverrides().storefrontUrl) })
  res.status(sent ? 200 : 502).json({
    sent,
    message: sent ? `Correo de prueba enviado a ${to}.` : "No se pudo enviar. Revisa la configuración SMTP (SMTP_HOST, usuario y contraseña).",
  })
}
