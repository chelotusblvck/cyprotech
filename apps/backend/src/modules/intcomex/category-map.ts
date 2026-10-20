import type { IwsCategory, IwsProduct } from "./client/types"

// Convierte la categoría de Intcomex en un handle de nuestras categorías (ver setup-chile.ts).
// Las reglas se evalúan en orden y gana la primera que coincide. Se basan en el texto de la
// categoría y de la descripción, no en IDs, porque los IDs reales del portafolio de Chile
// se confirman con la primera descarga real. Los productos sin regla quedan en borrador.

type Rule = { handle: string; test: RegExp }

const RULES: Rule[] = [
  { handle: "tarjetas-de-video", test: /tarjeta(s)? de video|graphics? card|\bgpu\b|\bvga\b/ },
  { handle: "procesadores", test: /procesador|\bcpu\b|processor/ },
  { handle: "placas-madre", test: /placa(s)? madre|motherboard|mainboard/ },
  { handle: "memoria-ram", test: /memoria(s)? ram|\bram\b|\bdimm\b|so-?dimm/ },
  { handle: "fuentes-de-poder", test: /fuente(s)? de poder|power supply|\bpsu\b/ },
  { handle: "gabinetes", test: /gabinete|\bcase\b|chasis/ },
  { handle: "refrigeracion", test: /refrigeraci|disipador|cooler|cooling|ventilador/ },
  { handle: "almacenamiento", test: /\bssd\b|disco (duro|solido)|\bhdd\b|almacenamiento|nvme|storage/ },
  { handle: "audifonos", test: /audifono|headset|headphone|auricular/ },
  { handle: "sillas-gamer", test: /\bsilla/ },
  { handle: "monitores", test: /monitor/ },
  { handle: "teclados", test: /teclado|keyboard/ },
  { handle: "mouse", test: /\bmouse\b|raton/ },
  { handle: "notebooks", test: /notebook|laptop/ },
  {
    handle: "computadores-de-escritorio",
    test: /computador(a)? (de escritorio|all in one)|all in one|desktop|escritorio/,
  },
  { handle: "impresoras", test: /impresora|printer|multifuncional/ },
  { handle: "access-points", test: /access point|punto de acceso/ },
  { handle: "routers", test: /\brouter/ },
  { handle: "switches", test: /\bswitch/ },
  {
    handle: "cableado-estructurado",
    test: /cableado|patch panel|bobina de cable|cable utp|\bcat ?[56]a?\b|\brack/,
  },
  { handle: "grabadores-nvr-dvr", test: /\bnvr\b|\bdvr\b|\bxvr\b|grabador/ },
  { handle: "control-de-acceso", test: /control de acceso|access control|biometric|lector de tarjeta/ },
  { handle: "alarmas", test: /alarma|alarm\b|sirena/ },
  {
    handle: "camaras-ip",
    test: /camara.*(ip|cctv|seguridad|vigilancia)|cctv|ip camera|(bala|domo).*ip/,
  },
  { handle: "accesorios", test: /accesorio|webcam|camara web|\bhub\b|adaptador|pendrive|soporte|\busb\b/ },
]

const GAMER_WORDS = /gamer|gaming|rgb|mecanico|mechanical/
const HIGH_REFRESH = /(144|165|180|240|360) ?hz/

const strip = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")

const flatten = (category?: IwsCategory): string[] => {
  if (!category) {
    return []
  }
  return [category.Description, ...(category.Subcategories ?? []).flatMap((sub) => flatten(sub))]
}

export const categoryPath = (product: IwsProduct) => flatten(product.Category).join(" > ")

const firstMatch = (haystack: string) => RULES.find((rule) => rule.test.test(haystack))?.handle ?? null

export const mapCategory = (product: IwsProduct): string | null => {
  const categoryText = strip(flatten(product.Category).join(" "))
  const description = strip(product.Description ?? "")

  // Primero la categoría de Intcomex; si no alcanza, la descripción del producto.
  const base = firstMatch(categoryText) ?? firstMatch(description)
  if (!base) {
    return null
  }

  const text = `${categoryText} ${description}`
  const isGamer = GAMER_WORDS.test(text)

  switch (base) {
    case "monitores":
      return isGamer || HIGH_REFRESH.test(text) ? "monitores-gamer" : "monitores"
    // Teclados y mouse están bajo Gaming; los comunes se muestran como accesorios de PC.
    case "teclados":
    case "mouse":
      return isGamer ? base : "accesorios"
    default:
      return base
  }
}
