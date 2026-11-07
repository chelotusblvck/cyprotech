import {
  COLORS,
  DEFAULT_BRAND,
  button,
  divider,
  esc,
  heading,
  label,
  layout,
  longDate,
  money,
  panel,
  paragraph,
  pill,
  row,
  spacer,
  stepper,
  type Brand,
} from "./layout"

export type EmailItem = {
  title: string
  variant?: string | null
  quantity: number
  unitPrice: number
  total: number
  image?: string | null
}

export type EmailAddress = {
  name: string
  line1: string
  line2?: string | null
  city?: string | null
  region?: string | null
  phone?: string | null
}

export type TrackingInfo = { carrier?: string | null; number?: string | null; url?: string | null }

export type OrderEmailData = {
  brand?: Partial<Brand>
  orderNumber: string
  customerName: string
  createdAt: string
  items: EmailItem[]
  subtotal: number
  shippingTotal: number
  discountTotal: number
  total: number
  address: EmailAddress
  shippingMethod: string
  eta: string
  paymentMethod: string
  orderUrl: string
  document?: { label: string; folio: number | string; url: string } | null
  tracking?: TrackingInfo[]
}

export type TransferEmailData = OrderEmailData & {
  bank: { holder: string; rut: string; bank: string; accountType: string; accountNumber: string; email: string }
  // Fecha limite para pagar, ya formateada ("26 de octubre").
  deadline: string
}

export type DocumentEmailData = {
  brand?: Partial<Brand>
  orderNumber: string
  customerName: string
  documentLabel: string
  folio: number | string
  total: number
  documentUrl: string
  orderUrl: string
}

export type AlertEmailData = {
  brand?: Partial<Brand>
  title: string
  message: string
  details?: string[]
  actionLabel?: string
  actionUrl?: string
}

export type StaffInviteEmailData = {
  brand?: Partial<Brand>
  // Enlace de un solo uso que abre la pantalla donde la persona crea su clave.
  inviteUrl: string
  // Días de vigencia que se le informan a quien recibe la invitación.
  validDays?: number
}

export type RenderedEmail = { subject: string; html: string; text: string }

const STEPS = ["Pago confirmado", "Preparando", "En camino", "Entregado"]
const brandOf = (partial?: Partial<Brand>): Brand => ({ ...DEFAULT_BRAND, ...partial })
const firstName = (name: string) => name.trim().split(/\s+/)[0] || "hola"

// ── Bloques compartidos ─────────────────────────────────────────────────────

const itemRow = (item: EmailItem) => {
  const initial = esc((item.title.trim()[0] ?? "C").toUpperCase())
  const tile = item.image
    ? `<img src="${esc(item.image)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border-radius:10px;object-fit:cover;background:#ffffff">`
    : `<table role="presentation" width="56" height="56" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" width="56" height="56" bgcolor="#1c1336" style="width:56px;height:56px;border-radius:10px;background:#1c1336;border:1px solid ${COLORS.line};font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:${COLORS.violet}">${initial}</td></tr></table>`
  return `<tr>
    <td width="72" valign="top" style="padding:14px 0;border-top:1px solid ${COLORS.line}">${tile}</td>
    <td valign="top" style="padding:14px 12px;border-top:1px solid ${COLORS.line};font-family:'Segoe UI',Arial,sans-serif">
      <div style="font-size:15px;line-height:1.45;font-weight:600;color:${COLORS.text}">${esc(item.title)}</div>
      <div style="padding-top:3px;font-size:13px;line-height:1.4;color:${COLORS.faint}">${item.variant ? `${esc(item.variant)} · ` : ""}${item.quantity} ${item.quantity === 1 ? "unidad" : "unidades"} · ${money(item.unitPrice)} c/u</div>
    </td>
    <td align="right" valign="top" style="padding:14px 0;border-top:1px solid ${COLORS.line};font-family:'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:600;color:${COLORS.text};white-space:nowrap">${money(item.total)}</td>
  </tr>`
}

const itemsTable = (items: EmailItem[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items.map(itemRow).join("")}</table>`

const totalRow = (text: string, value: string, strong = false) =>
  `<tr>
    <td style="padding:5px 0;font-family:'Segoe UI',Arial,sans-serif;font-size:${strong ? 18 : 14}px;color:${strong ? COLORS.text : COLORS.muted};font-weight:${strong ? 700 : 400}">${esc(text)}</td>
    <td align="right" style="padding:5px 0;font-family:'Segoe UI',Arial,sans-serif;font-size:${strong ? 22 : 14}px;color:${strong ? COLORS.cyan : COLORS.text};font-weight:${strong ? 700 : 400};white-space:nowrap">${value}</td>
  </tr>`

const totalsTable = (data: OrderEmailData) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${COLORS.line}">
    <tr><td colspan="2" style="height:10px;line-height:10px;font-size:1px">&nbsp;</td></tr>
    ${totalRow("Subtotal", money(data.subtotal))}
    ${totalRow("Despacho", data.shippingTotal > 0 ? money(data.shippingTotal) : "Gratis")}
    ${data.discountTotal > 0 ? totalRow("Descuento", money(-data.discountTotal)) : ""}
    <tr><td colspan="2" style="height:6px;line-height:6px;font-size:1px">&nbsp;</td></tr>
    ${totalRow("Total", money(data.total), true)}
    <tr><td colspan="2" align="right" style="padding-top:2px;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:${COLORS.faint}">IVA incluido</td></tr>
  </table>`

const infoBlock = (title: string, lines: string[], highlight?: string) =>
  panel(
    `${label(title)}<div style="padding-top:10px;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;line-height:1.65;color:${COLORS.text}">${lines
      .filter(Boolean)
      .map((line, index) => (index === 0 ? `<strong>${line}</strong>` : `<span style="color:${COLORS.muted}">${line}</span>`))
      .join("<br>")}${
      highlight
        ? `<div style="padding-top:12px;font-weight:600;color:${COLORS.cyan}">${highlight}</div>`
        : ""
    }</div>`,
  )

const twoColumns = (left: string, right: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td class="stack" width="50%" height="100%" valign="top" style="padding-right:8px;height:100%">${left}</td>
    <td class="stack stack-gap" width="50%" height="100%" valign="top" style="padding-left:8px;height:100%">${right}</td>
  </tr></table>`

const addressLines = (address: EmailAddress) => [
  esc(address.name),
  esc([address.line1, address.line2].filter(Boolean).join(", ")),
  esc([address.city, address.region].filter(Boolean).join(", ")),
  address.phone ? esc(address.phone) : "",
]

const trackingBlock = (tracking: TrackingInfo[]) =>
  tracking
    .map((entry) =>
      panel(
        `${label("Seguimiento", COLORS.cyan)}<div style="padding-top:10px;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.6;color:${COLORS.text}">${
          entry.carrier ? `<strong>${esc(entry.carrier)}</strong><br>` : ""
        }${
          entry.number
            ? `<span style="font-family:'Courier New',monospace;font-size:17px;letter-spacing:1px;color:${COLORS.cyan}">${esc(entry.number)}</span>`
            : `<span style="color:${COLORS.muted}">El número de seguimiento se informará pronto.</span>`
        }${
          entry.url
            ? `<br><a href="${esc(entry.url)}" style="color:${COLORS.violet};font-size:14px">Seguir mi envío</a>`
            : ""
        }</div>`,
      ),
    )
    .join(`<div style="height:10px;line-height:10px;font-size:1px">&nbsp;</div>`)

const documentNote = (data: OrderEmailData) =>
  data.document
    ? panel(
        `${label("Documento tributario")}<div style="padding-top:10px;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;line-height:1.65;color:${COLORS.muted}"><strong style="color:${COLORS.text}">${esc(data.document.label)} N° ${esc(data.document.folio)}</strong><br><a href="${esc(data.document.url)}" style="color:${COLORS.violet}">Descargar documento</a></div>`,
      )
    : panel(
        `${label("Documento tributario")}<div style="padding-top:10px;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;line-height:1.65;color:${COLORS.muted}">Tu boleta o factura electrónica te llegará en un correo aparte, en cuanto se emita.</div>`,
      )

const summaryText = (data: OrderEmailData) =>
  [
    ...data.items.map((item) => `- ${item.title} x${item.quantity}  ${money(item.total)}`),
    "",
    `Subtotal: ${money(data.subtotal)}`,
    `Despacho: ${data.shippingTotal > 0 ? money(data.shippingTotal) : "Gratis"}`,
    ...(data.discountTotal > 0 ? [`Descuento: ${money(-data.discountTotal)}`] : []),
    `Total: ${money(data.total)} (IVA incluido)`,
  ].join("\n")

const hero = (eyebrow: string, title: string, subtitle: string, orderNumber: string, tone = COLORS.lime) =>
  `${spacer(34)}
   ${row(`${label(eyebrow, tone)}<div style="height:12px;line-height:12px;font-size:1px">&nbsp;</div>${heading(title)}<div style="height:14px;line-height:14px;font-size:1px">&nbsp;</div>${paragraph(esc(subtitle))}<div style="height:18px;line-height:18px;font-size:1px">&nbsp;</div>${pill(orderNumber)}`)}`

const gap = (px = 24) => spacer(px)

// ── Plantillas ──────────────────────────────────────────────────────────────

export const renderOrderConfirmed = (data: OrderEmailData): RenderedEmail => {
  const brand = brandOf(data.brand)
  const body = [
    hero(
      "Pago confirmado",
      `¡Gracias, ${firstName(data.customerName)}!`,
      "Tu pedido está confirmado y ya lo estamos preparando. Te avisaremos apenas salga hacia tu dirección.",
      data.orderNumber,
    ),
    gap(),
    row(stepper(STEPS, 1)),
    gap(30),
    divider(),
    gap(8),
    row(`${label("Tu pedido")}<div style="height:6px;line-height:6px;font-size:1px">&nbsp;</div>${itemsTable(data.items)}${totalsTable(data)}`),
    gap(),
    row(
      twoColumns(
        infoBlock("Despacho", addressLines(data.address), `${esc(data.shippingMethod)} · ${esc(data.eta)}`),
        infoBlock("Pago", [esc(data.paymentMethod), `Pedido del ${longDate(data.createdAt)}`]),
      ),
    ),
    gap(12),
    row(documentNote(data)),
    gap(30),
    row(button("Ver mi pedido", data.orderUrl)),
    gap(40),
  ].join("")

  return {
    subject: `Pedido ${data.orderNumber} confirmado`,
    html: layout({ preheader: "Recibimos tu pago. Estamos preparando tu pedido.", title: `Pedido ${data.orderNumber} confirmado`, body, brand }),
    text: [
      `¡Gracias, ${firstName(data.customerName)}! Tu pedido ${data.orderNumber} está confirmado.`,
      "",
      summaryText(data),
      "",
      `Despacho: ${[data.address.line1, data.address.city, data.address.region].filter(Boolean).join(", ")}`,
      `${data.shippingMethod}: ${data.eta}`,
      "",
      `Ver mi pedido: ${data.orderUrl}`,
    ].join("\n"),
  }
}

// Pedido recibido, a la espera de la transferencia. No dice "confirmado": eso llega cuando se acredita el pago.
export const renderOrderAwaitingTransfer = (data: TransferEmailData): RenderedEmail => {
  const brand = brandOf(data.brand)
  const bank = data.bank
  const body = [
    hero(
      "Pedido recibido",
      `Gracias, ${firstName(data.customerName)}`,
      `Para confirmar tu pedido, transfiere ${money(data.total)} antes del ${data.deadline}. Lo reservamos hasta entonces.`,
      data.orderNumber,
      COLORS.cyan,
    ),
    gap(),
    row(
      infoBlock("Datos para la transferencia", [
        esc(bank.holder),
        `RUT ${esc(bank.rut)}`,
        `${esc(bank.bank)} · ${esc(bank.accountType)}`,
        `N° ${esc(bank.accountNumber)}`,
        esc(bank.email),
      ]),
    ),
    gap(12),
    row(
      paragraph(
        `Indica el número de pedido <strong>${esc(data.orderNumber)}</strong> en el comentario y envía el comprobante a ${esc(bank.email)}. Cuando veamos el pago te avisaremos y prepararemos tu pedido.`,
      ),
    ),
    gap(),
    divider(),
    gap(8),
    row(`${label("Tu pedido")}<div style="height:6px;line-height:6px;font-size:1px">&nbsp;</div>${itemsTable(data.items)}${totalsTable(data)}`),
    gap(),
    row(infoBlock("Despacho", addressLines(data.address), `${esc(data.shippingMethod)} · ${esc(data.eta)}`)),
    gap(30),
    row(button("Ver mi pedido", data.orderUrl)),
    gap(40),
  ].join("")

  return {
    subject: `Pedido ${data.orderNumber}: falta tu transferencia`,
    html: layout({
      preheader: `Transfiere ${money(data.total)} antes del ${data.deadline} para confirmar tu pedido.`,
      title: `Pedido ${data.orderNumber} pendiente de pago`,
      body,
      brand,
    }),
    text: [
      `Gracias, ${firstName(data.customerName)}. Recibimos tu pedido ${data.orderNumber}.`,
      `Para confirmarlo, transfiere ${money(data.total)} antes del ${data.deadline}:`,
      "",
      `${bank.holder} - RUT ${bank.rut}`,
      `${bank.bank} - ${bank.accountType} N° ${bank.accountNumber}`,
      `Correo: ${bank.email}`,
      `Comentario: ${data.orderNumber}`,
      "",
      summaryText(data),
      "",
      `Ver mi pedido: ${data.orderUrl}`,
    ].join("\n"),
  }
}

export const renderOrderShipped = (data: OrderEmailData): RenderedEmail => {
  const brand = brandOf(data.brand)
  const tracking = data.tracking?.length ? data.tracking : [{}]
  const body = [
    hero(
      "En camino",
      "Tu pedido va en camino",
      `Ya salió hacia ${data.address.city ?? "tu dirección"}. Llegará en ${data.eta}.`,
      data.orderNumber,
      COLORS.cyan,
    ),
    gap(),
    row(stepper(STEPS, 2)),
    gap(28),
    row(trackingBlock(tracking)),
    gap(24),
    divider(),
    gap(8),
    row(`${label("Lo que va en tu pedido")}<div style="height:6px;line-height:6px;font-size:1px">&nbsp;</div>${itemsTable(data.items)}`),
    gap(20),
    row(infoBlock("Entrega en", addressLines(data.address))),
    gap(30),
    row(button("Ver mi pedido", data.orderUrl)),
    gap(40),
  ].join("")

  return {
    subject: `Tu pedido ${data.orderNumber} va en camino`,
    html: layout({ preheader: "Tu pedido ya salió. Aquí está tu seguimiento.", title: "Tu pedido va en camino", body, brand }),
    text: [
      `Tu pedido ${data.orderNumber} va en camino. Llegará en ${data.eta}.`,
      "",
      ...tracking.map((t) => `Seguimiento: ${[t.carrier, t.number, t.url].filter(Boolean).join(" · ") || "pronto"}`),
      "",
      `Ver mi pedido: ${data.orderUrl}`,
    ].join("\n"),
  }
}

export const renderOrderDelivered = (data: OrderEmailData): RenderedEmail => {
  const brand = brandOf(data.brand)
  const body = [
    hero(
      "Entregado",
      "Tu pedido fue entregado",
      "Esperamos que lo disfrutes. Si algo no llegó como esperabas, escríbenos y lo resolvemos.",
      data.orderNumber,
    ),
    gap(),
    row(stepper(STEPS, STEPS.length)),
    gap(28),
    divider(),
    gap(8),
    row(`${label("Tu pedido")}<div style="height:6px;line-height:6px;font-size:1px">&nbsp;</div>${itemsTable(data.items)}`),
    gap(30),
    row(button("Seguir comprando", brand.storefrontUrl)),
    gap(40),
  ].join("")

  return {
    subject: `Tu pedido ${data.orderNumber} fue entregado`,
    html: layout({ preheader: "Tu pedido llegó. ¡Gracias por comprar en Cyprotech!", title: "Tu pedido fue entregado", body, brand }),
    text: `Tu pedido ${data.orderNumber} fue entregado. Si algo no llegó como esperabas, escríbenos a ${brand.supportEmail}.`,
  }
}

export const renderDocumentReady = (data: DocumentEmailData): RenderedEmail => {
  const brand = brandOf(data.brand)
  const body = [
    hero(
      "Documento tributario",
      `Tu ${data.documentLabel.toLowerCase()} está lista`,
      `Emitimos tu ${data.documentLabel.toLowerCase()} por el pedido ${data.orderNumber}. La encuentras adjunta a este correo y también puedes descargarla cuando quieras.`,
      `${data.documentLabel} N° ${data.folio}`,
      COLORS.violet,
    ),
    gap(),
    row(
      panel(
        `${label("Monto")}<div style="padding-top:8px;font-family:'Segoe UI',Arial,sans-serif;font-size:30px;font-weight:700;color:${COLORS.cyan}">${money(data.total)}</div><div style="padding-top:2px;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:${COLORS.faint}">IVA incluido</div>`,
      ),
    ),
    gap(28),
    row(button("Descargar documento", data.documentUrl)),
    gap(16),
    row(`<a href="${esc(data.orderUrl)}" style="font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:${COLORS.violet};text-decoration:none">Ver mi pedido</a>`),
    gap(40),
  ].join("")

  return {
    subject: `Tu ${data.documentLabel.toLowerCase()} N° ${data.folio} · Pedido ${data.orderNumber}`,
    html: layout({ preheader: `Tu ${data.documentLabel.toLowerCase()} electrónica está adjunta.`, title: `${data.documentLabel} N° ${data.folio}`, body, brand }),
    text: `Tu ${data.documentLabel.toLowerCase()} N° ${data.folio} por el pedido ${data.orderNumber} (${money(data.total)}, IVA incluido).\nDescárgala aquí: ${data.documentUrl}`,
  }
}

export const renderInternalAlert = (data: AlertEmailData): RenderedEmail => {
  const brand = brandOf(data.brand)
  const body = [
    hero("Alerta interna", data.title, data.message, "Requiere acción", COLORS.danger),
    ...(data.details?.length
      ? [
          gap(),
          row(
            panel(
              data.details
                .map(
                  (line) =>
                    `<div style="padding:3px 0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;line-height:1.55;color:${COLORS.muted}">${esc(line)}</div>`,
                )
                .join(""),
            ),
          ),
        ]
      : []),
    ...(data.actionUrl ? [gap(28), row(button(data.actionLabel ?? "Abrir el dashboard", data.actionUrl))] : []),
    gap(40),
  ].join("")

  return {
    subject: `[Cyprotech] ${data.title}`,
    html: layout({ preheader: data.message, title: data.title, body, brand }),
    text: [data.title, "", data.message, ...(data.details ?? []), ...(data.actionUrl ? ["", data.actionUrl] : [])].join("\n"),
  }
}

// Invitación al panel de administración: la persona abre el enlace y crea su propia clave.
export const renderStaffInvite = (data: StaffInviteEmailData): RenderedEmail => {
  const brand = brandOf(data.brand)
  const validDays = data.validDays ?? 7
  const body = [
    spacer(34),
    row(
      `${label("Panel de administración", COLORS.cyan)}<div style="height:12px;line-height:12px;font-size:1px">&nbsp;</div>${heading("Te invitaron a administrar Cyprotech")}<div style="height:14px;line-height:14px;font-size:1px">&nbsp;</div>${paragraph(
        "Crea tu clave con el botón de abajo y entra al panel de la tienda. Solo tú vas a conocerla.",
      )}`,
    ),
    gap(28),
    row(button("Crear mi clave", data.inviteUrl)),
    gap(24),
    row(
      panel(
        `${label("Antes de entrar")}<div style="padding-top:10px;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;line-height:1.65;color:${COLORS.muted}">El enlace sirve una sola vez y vence en ${validDays} días. Es personal: no lo reenvíes, porque da acceso de administrador. Si no esperabas esta invitación, ignora este correo.</div>`,
      ),
    ),
    gap(40),
  ].join("")

  return {
    subject: "Te invitaron al panel de Cyprotech",
    html: layout({
      preheader: "Crea tu clave para entrar al panel de administración.",
      title: "Invitación al panel de Cyprotech",
      body,
      brand,
    }),
    text: [
      "Te invitaron a administrar Cyprotech.",
      "",
      `Crea tu clave aquí: ${data.inviteUrl}`,
      "",
      `El enlace sirve una sola vez y vence en ${validDays} días. Es personal: no lo reenvíes.`,
      "Si no esperabas esta invitación, ignora este correo.",
    ].join("\n"),
  }
}

export const TEMPLATES = {
  "staff-invite": renderStaffInvite,
  "order-confirmed": renderOrderConfirmed,
  "order-awaiting-transfer": renderOrderAwaitingTransfer,
  "order-shipped": renderOrderShipped,
  "order-delivered": renderOrderDelivered,
  "document-ready": renderDocumentReady,
  "internal-alert": renderInternalAlert,
} as const

export type TemplateName = keyof typeof TEMPLATES

export const isTemplateName = (value: string): value is TemplateName => value in TEMPLATES

export const renderTemplate = (name: TemplateName, data: unknown): RenderedEmail =>
  (TEMPLATES[name] as (input: never) => RenderedEmail)(data as never)
