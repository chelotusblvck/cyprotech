// Comparacion de precios con el mercado chileno. Solo logica pura (sin red): el script
// scripts/compare-prices.ts consulta las tiendas y usa estas funciones para cruzar y calcular.

export type MarketOffer = {
  store: string
  title: string
  url: string
  priceClp: number
  // Texto de la tienda con el que se cruza el numero de parte (titulo, SKU, descripcion corta).
  matchText: string
  // Aclaracion del precio (ej. "transferencia"), tal como lo publica la tienda.
  note?: string
}

// Numero de parte sin separadores ni mayusculas: "910-005550" -> "910005550".
export const normalizePartNumber = (value: string): string => value.toUpperCase().replace(/[^A-Z0-9]/g, "")

// Un numero de parte muy corto genera falsos cruces ("A400" aparece en cualquier texto).
export const MIN_PART_NUMBER_LENGTH = 5

// Cruce exacto por numero de parte: el MPN debe aparecer completo en el texto de la oferta, delimitado
// por caracteres que no sean alfanumericos (para que "G502" no cruce con "G5021").
export const matchesPartNumber = (mpn: string | null | undefined, matchText: string): boolean => {
  const normalized = normalizePartNumber(mpn ?? "")
  if (normalized.length < MIN_PART_NUMBER_LENGTH) {
    return false
  }
  const haystack = ` ${matchText.toUpperCase().replace(/[^A-Z0-9]+/g, " ")} `
  const compactTokens = haystack.trim().split(" ")
  // Pegado ("910005550") o con separadores distintos ("910 005550"): se prueban tokens contiguos.
  for (let start = 0; start < compactTokens.length; start += 1) {
    let joined = ""
    for (let end = start; end < Math.min(start + 4, compactTokens.length); end += 1) {
      joined += compactTokens[end]
      if (joined === normalized) {
        return true
      }
      if (joined.length >= normalized.length) {
        break
      }
    }
  }
  return false
}

// Medidas y estandares que llevan digitos pero no identifican un modelo.
const GENERIC_TOKEN = /^(\d+(gb|tb|mb|mhz|ghz|hz|w|mm|in|dpi|mt\/s)|ddr\d|usb\d?|pcie\d?|gen\d|\d+k|ps\d)$/i

// Terminos de busqueda para una tienda: muchas no indexan el numero de parte, pero si el modelo del titulo
// ("G915"). El cruce final sigue siendo por numero de parte exacto (matchesPartNumber).
export const searchTerms = (title: string, mpn: string | null | undefined): string[] => {
  const terms: string[] = []
  if (mpn && normalizePartNumber(mpn).length >= MIN_PART_NUMBER_LENGTH) {
    terms.push(mpn)
  }
  const model = title
    .split(/\s+/)
    .map((token) => token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ""))
    .find((token) => /[A-Za-z]/.test(token) && /\d/.test(token) && token.length >= 3 && !GENERIC_TOKEN.test(token))
  if (model && !terms.some((term) => term.toLowerCase() === model.toLowerCase())) {
    terms.push(model)
  }
  return terms
}

export const median = (values: number[]): number | null => {
  if (!values.length) {
    return null
  }
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

export type MarginInput = {
  publicPrice: number
  costNetClp: number
  ivaPercent: number
  paymentFeePercent: number
}

// Margen neto sobre el costo despues de la comision de la pasarela (que se cobra sobre el monto con IVA).
export const marginAfterFee = ({ publicPrice, costNetClp, ivaPercent, paymentFeePercent }: MarginInput): number => {
  if (costNetClp <= 0) {
    return 0
  }
  const netSale = publicPrice / (1 + ivaPercent / 100)
  const fee = publicPrice * (paymentFeePercent / 100)
  return ((netSale - fee - costNetClp) / costNetClp) * 100
}

// Precio publico minimo que deja minNetMarginPercent despues de la comision.
export const floorPublicPrice = (
  costNetClp: number,
  config: { ivaPercent: number; paymentFeePercent: number; minNetMarginPercent: number; roundTo: number },
): number => {
  const netPerPublic = 1 / (1 + config.ivaPercent / 100) - config.paymentFeePercent / 100
  const raw = (costNetClp * (1 + config.minNetMarginPercent / 100)) / netPerPublic
  const step = config.roundTo > 0 ? config.roundTo : 1
  return Math.ceil(raw / step - 1e-9) * step
}

export type PriceSuggestion = {
  // Precio objetivo = max(piso, mediana del mercado menos el descuento); null si no hay mercado.
  suggested: number | null
  belowFloor: boolean
}

// discountPercent: pequeno descuento sobre la mediana para ser competitivo (ej. 1).
export const suggestPrice = (
  floorPrice: number,
  marketMedian: number | null,
  discountPercent: number,
  roundTo: number,
): PriceSuggestion => {
  if (marketMedian === null) {
    return { suggested: null, belowFloor: false }
  }
  const step = roundTo > 0 ? roundTo : 1
  const target = Math.floor((marketMedian * (1 - discountPercent / 100)) / step) * step
  return { suggested: Math.max(floorPrice, target), belowFloor: marketMedian < floorPrice }
}

export const csvCell = (value: string | number | null | undefined): string => {
  const text = value === null || value === undefined ? "" : String(value)
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
