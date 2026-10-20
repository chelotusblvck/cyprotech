// RUT chileno: cuerpo + dígito verificador (módulo 11). El backend vuelve a validarlo al emitir.
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

// Devuelve el RUT con formato "12345678-5" o null si no es válido.
export const normalizeRut = (input: string | null | undefined): string | null => {
  const clean = (input ?? "").replace(/[.\s-]/g, "").toUpperCase()
  if (!/^\d{7,8}[\dK]$/.test(clean)) {
    return null
  }
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  return computeDv(body) === dv ? `${body}-${dv}` : null
}
