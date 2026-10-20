// RUT chileno: cuerpo + dígito verificador (módulo 11).

export type Rut = { body: string; dv: string; formatted: string }

const computeDv = (body: string) => {
  let sum = 0
  let factor = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * factor
    factor = factor === 7 ? 2 : factor + 1
  }
  const rest = 11 - (sum % 11)
  return rest === 11 ? "0" : rest === 10 ? "K" : String(rest)
}

// Acepta "12.345.678-5", "12345678-5" o "123456785". Devuelve null si el dígito verificador no calza.
export const parseRut = (input: string | null | undefined): Rut | null => {
  const clean = (input ?? "").replace(/[.\s-]/g, "").toUpperCase()
  if (!/^\d{7,8}[\dK]$/.test(clean)) {
    return null
  }
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  if (computeDv(body) !== dv) {
    return null
  }
  return { body, dv, formatted: `${body}-${dv}` }
}

// RUT genérico que el SII usa para boletas a consumidor final.
export const CONSUMIDOR_FINAL = "66666666-6"
