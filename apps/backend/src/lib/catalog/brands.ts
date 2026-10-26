// Marca canonica y etiqueta "gamer" de un producto, a partir del titulo y de la marca que entrega Intcomex.
// Intcomex mezcla lineas bajo nombres distintos ("Kingston Fury", "KNG", "ROG"): aqui se unifican bajo una
// marca y la linea queda como dato aparte.

export type BrandRule = {
  // Marca canonica que se muestra y se filtra.
  brand: string
  // Nombres con los que aparece en la marca o al inicio del titulo (sin distinguir mayusculas).
  aliases: string[]
  // Linea comercial si el alias corresponde a una (Fury, ROG...).
  line?: string
}

// El orden importa: las lineas especificas van antes que la marca general (Kingston Fury antes que Kingston).
export const BRAND_RULES: BrandRule[] = [
  { brand: "Kingston", line: "Fury", aliases: ["kingston fury", "kng fury"] },
  { brand: "Kingston", line: "ValueRam", aliases: ["kingston valueram"] },
  { brand: "Kingston", aliases: ["kingston", "kng"] },
  { brand: "ASUS", line: "ROG", aliases: ["asus rog", "rog"] },
  { brand: "ASUS", line: "TUF", aliases: ["asus tuf", "tuf"] },
  { brand: "ASUS", aliases: ["asus"] },
  { brand: "Primus Gaming", aliases: ["primus gaming", "primus"] },
  { brand: "Klip Xtreme", aliases: ["klip xtreme", "klipxtreme"] },
  { brand: "Logitech", aliases: ["logitech"] },
  { brand: "HyperX", aliases: ["hyperx"] },
  { brand: "Razer", aliases: ["razer"] },
  { brand: "Samsung", aliases: ["samsung"] },
  { brand: "Xiaomi", aliases: ["xiaomi"] },
  { brand: "Xtech", aliases: ["xtech"] },
  { brand: "MSI", aliases: ["msi"] },
  { brand: "AMD", aliases: ["amd"] },
  { brand: "Intel", aliases: ["intel"] },
  { brand: "Clio", aliases: ["clio"] },
]

export type BrandMatch = { brand: string; line: string | null }

const startsWithWord = (text: string, alias: string) => {
  if (!text.startsWith(alias)) {
    return false
  }
  const next = text[alias.length]
  return next === undefined || !/[a-z0-9]/.test(next)
}

// Prioriza la marca informada por Intcomex y, si no sirve, el inicio del titulo.
export const detectBrand = (input: { title: string; brand?: string | null }): BrandMatch | null => {
  const candidates = [input.brand, input.title]
    .map((value) => (value ?? "").trim().toLowerCase())
    .filter(Boolean)
  for (const candidate of candidates) {
    for (const rule of BRAND_RULES) {
      if (rule.aliases.some((alias) => startsWithWord(candidate, alias))) {
        return { brand: rule.brand, line: rule.line ?? null }
      }
    }
  }
  // Titulos tipo "Asus ROG Mon ..." donde la linea aparece despues de la marca.
  const title = (input.title ?? "").toLowerCase()
  for (const rule of BRAND_RULES) {
    if (rule.line && rule.aliases.some((alias) => title.includes(alias))) {
      return { brand: rule.brand, line: rule.line }
    }
  }
  return null
}

// Marcas cuyo catalogo es gamer completo.
const GAMER_BRANDS = ["Razer", "HyperX", "Primus Gaming"]
// Lineas gamer dentro de marcas mixtas.
const GAMER_LINES = ["Fury", "ROG", "TUF"]

const TITLE_PATTERNS: RegExp[] = [
  /\bgaming\b/i,
  /\bgamer\b/i,
  /\brgb\b/i,
  // Series G de Logitech: "G502", "G PRO X", "G915".
  /\bg\s?pro\b/i,
  /\bg\d{3}\b/i,
  /\bodyssey\b/i,
  /\brenegade\b/i,
  /\bbeast\b/i,
  // Monitores de alta frecuencia: 144 Hz o mas.
  /\b(1[4-9]\d|[2-9]\d\d)\s?hz\b/i,
]

// Categorias de Intcomex que son gamer por si mismas.
const GAMER_CATEGORY_PATTERNS: RegExp[] = [/tarjetas?\s+(de\s+)?video/i, /graphics/i, /silla/i]

export const isGamer = (input: {
  title: string
  brand?: string | null
  categoryPath?: string | null
}): boolean => {
  const match = detectBrand(input)
  if (match && (GAMER_BRANDS.includes(match.brand) || (match.line && GAMER_LINES.includes(match.line)))) {
    return true
  }
  if (TITLE_PATTERNS.some((pattern) => pattern.test(input.title))) {
    return true
  }
  const title = input.title.toLowerCase()
  if (/\btarjeta\s+video\b/.test(title) || /\bvideo\s?card\b/.test(title)) {
    return true
  }
  return GAMER_CATEGORY_PATTERNS.some((pattern) => pattern.test(input.categoryPath ?? ""))
}

export const GAMER_TAG = "gamer"
