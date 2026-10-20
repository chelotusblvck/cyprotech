import { createHash } from "crypto"

// Formato exigido por IWS: YYYY-MM-DDTHH:mm:ssZ (UTC, sin milisegundos).
export const formatUtcTimestamp = (date: Date = new Date()) =>
  date.toISOString().replace(/\.\d{3}Z$/, "Z")

// signature = SHA-256 (hex) de "apiKey,accessKey,utcTimeStamp".
export const buildSignature = (apiKey: string, accessKey: string, utcTimeStamp: string) =>
  createHash("sha256").update(`${apiKey},${accessKey},${utcTimeStamp}`).digest("hex")

// Valor del header Authorization. La Access Key solo se usa para firmar, nunca viaja.
export const buildAuthorizationHeader = (
  apiKey: string,
  accessKey: string,
  date: Date = new Date(),
) => {
  const utcTimeStamp = formatUtcTimestamp(date)
  const signature = buildSignature(apiKey, accessKey, utcTimeStamp)
  return `Bearer apiKey=${apiKey}&utcTimeStamp=${utcTimeStamp}&signature=${signature}`
}
