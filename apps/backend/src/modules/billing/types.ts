// Tipos de documento tributario electrónico (DTE) que emite la tienda.
export const DTE = {
  FACTURA: 33,
  BOLETA: 39,
  NOTA_CREDITO: 61,
} as const

export type DteType = (typeof DTE)[keyof typeof DTE]

export const DTE_LABEL: Record<number, string> = {
  33: "Factura electrónica",
  39: "Boleta electrónica",
  61: "Nota de crédito electrónica",
}

// Quién emite. Son los datos de Garage360 ante el SII.
export type Emisor = {
  rut: string
  razonSocial: string
  giro: string
  // Código de actividad económica (Acteco).
  acteco: number
  direccion: string
  comuna: string
  // Código de sucursal SII, si la empresa tiene.
  codigoSucursal?: string
  correo?: string
}

// Receptor de una factura (obligatorio) o de una boleta (opcional).
export type Receptor = {
  rut: string
  razonSocial?: string
  giro?: string
  direccion?: string
  comuna?: string
  correo?: string
}

// Lo que el cliente pide en el checkout: boleta (por defecto) o factura con sus datos.
export type DocumentRequest =
  | { type: "boleta"; rut?: string }
  | {
      type: "factura"
      rut: string
      razonSocial: string
      giro: string
      direccion: string
      comuna: string
    }

export type OrderForBilling = {
  id: string
  display_id?: number | null
  email?: string | null
  created_at: string | Date
  total: number
  shipping_total?: number | null
  metadata?: Record<string, unknown> | null
  items?: {
    title?: string | null
    product_title?: string | null
    quantity: number
    unit_price: number
    total?: number | null
  }[]
  shipping_address?: {
    first_name?: string | null
    last_name?: string | null
  } | null
}

export type DteLine = {
  name: string
  quantity: number
  // Boleta: con IVA. Factura: neto.
  unitPrice: number
  total: number
}

export type DteTotals = { neto: number; iva: number; total: number }

// Nombre de archivo en ASCII (los encabezados HTTP y muchos clientes de correo no manejan tildes).
export const documentFileName = (type: number, folio: number | string | null) =>
  `${(DTE_LABEL[type] ?? "documento")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")}-${folio ?? "sin-folio"}.pdf`
