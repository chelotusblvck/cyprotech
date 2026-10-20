export type SmtpConfig = {
  host: string
  port: number
  secure: boolean
  user?: string
  password?: string
  from: string
}

// En desarrollo, sin SMTP_HOST, los correos van a Mailpit (127.0.0.1:1025) y se ven en
// http://localhost:8025. En producción SMTP_HOST es obligatorio: sin él no se envía nada.
export const loadSmtpConfig = (env: NodeJS.ProcessEnv = process.env): SmtpConfig | null => {
  const host = env.SMTP_HOST?.trim()
  if (!host && env.NODE_ENV === "production") {
    return null
  }
  const port = Number(env.SMTP_PORT) || (host ? 587 : 1025)
  return {
    host: host || "127.0.0.1",
    port,
    // 465 usa TLS directo; 587 y 25 negocian STARTTLS.
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465,
    user: env.SMTP_USER?.trim() || undefined,
    password: env.SMTP_PASSWORD || undefined,
    from: env.MAIL_FROM?.trim() || "Cyprotech <no-reply@cyprotech.cl>",
  }
}
