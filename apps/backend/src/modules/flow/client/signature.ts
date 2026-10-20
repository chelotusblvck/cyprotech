import { createHmac } from "crypto"

type Params = Record<string, string | number | boolean | undefined | null>

// Los parámetros se ordenan alfabéticamente por nombre y se concatenan como nombre + valor,
// sin separadores. Ej.: { apiKey: "X", currency: "CLP", amount: 5000 } -> "amount5000apiKeyXcurrencyCLP".
export const buildSigningString = (params: Params) =>
  Object.keys(params)
    .filter((key) => key !== "s" && params[key] !== undefined && params[key] !== null)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("")

// Firma HMAC-SHA256 (hex) del string anterior con la secretKey del comercio.
export const sign = (params: Params, secretKey: string) =>
  createHmac("sha256", secretKey).update(buildSigningString(params)).digest("hex")

// Devuelve los parámetros con la firma agregada en "s".
export const withSignature = <T extends Params>(params: T, secretKey: string) => ({
  ...params,
  s: sign(params, secretKey),
})
