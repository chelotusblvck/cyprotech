// Sistema visual de los correos de Cyprotech. Son tablas con estilos en línea porque es lo único que
// todos los clientes de correo (Gmail, Outlook, Apple Mail) interpretan igual. El degradé de la
// marca se reemplaza por una barra de tres colores sólidos, que se ve igual en todas partes.

export const COLORS = {
  page: "#07040f",
  card: "#100a20",
  panel: "#17102e",
  line: "#2d1f55",
  text: "#f6f2ff",
  muted: "#b8acde",
  faint: "#8678b0",
  violet: "#a855f7",
  violetDeep: "#7c3aed",
  magenta: "#ff2bd6",
  cyan: "#22d3ee",
  lime: "#a3ff12",
  danger: "#fb7185",
}

const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"
const DISPLAY = "'Chakra Petch', 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif"

export const esc = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const clpFormat = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })

// -$20.159 (Intl pone el signo después del símbolo en es-CL).
export const money = (value: number) => {
  const rounded = Math.round(value)
  return `${rounded < 0 ? "-" : ""}${clpFormat.format(Math.abs(rounded))}`
}

export const longDate = (iso: string) =>
  new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeZone: "America/Santiago" }).format(new Date(iso))

export type Brand = {
  name: string
  supportEmail: string
  storefrontUrl: string
  developerName: string
  developerUrl: string
}

export const DEFAULT_BRAND: Brand = {
  name: "Cyprotech",
  supportEmail: "contacto@cyprotech.cl",
  storefrontUrl: "http://localhost:8000",
  developerName: "Garage360",
  developerUrl: "https://garage360.cl",
}

export const spacer = (height: number) =>
  `<tr><td style="height:${height}px;line-height:${height}px;font-size:1px">&nbsp;</td></tr>`

export const heading = (text: string, size = 30) =>
  `<h1 style="margin:0;font-family:${DISPLAY};font-size:${size}px;line-height:1.15;font-weight:700;letter-spacing:-0.5px;color:${COLORS.text}">${esc(text)}</h1>`

export const paragraph = (html: string, color = COLORS.muted) =>
  `<p style="margin:0;font-family:${FONT};font-size:16px;line-height:1.65;color:${color}">${html}</p>`

export const label = (text: string, color = COLORS.faint) =>
  `<span style="font-family:${DISPLAY};font-size:12px;line-height:1;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${color}">${esc(text)}</span>`

// Etiqueta con borde para el número de pedido.
export const pill = (text: string) =>
  `<span style="display:inline-block;padding:7px 14px;border:1px solid ${COLORS.line};border-radius:999px;background:${COLORS.panel};font-family:${DISPLAY};font-size:13px;font-weight:600;letter-spacing:1.5px;color:${COLORS.violet}">${esc(text)}</span>`

// Botón principal. Es una tabla con bgcolor para que Outlook también pinte el fondo.
export const button = (text: string, url: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${COLORS.violetDeep}" style="border-radius:10px;background:${COLORS.violetDeep}"><a href="${esc(url)}" target="_blank" style="display:inline-block;padding:15px 34px;font-family:${DISPLAY};font-size:15px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;text-decoration:none;border-radius:10px">${esc(text)}</a></td></tr></table>`

export const panel = (inner: string) =>
  `<table role="presentation" width="100%" height="100%" cellpadding="0" cellspacing="0" border="0" style="height:100%;background:${COLORS.panel};border:1px solid ${COLORS.line};border-radius:14px"><tr><td valign="top" style="padding:20px 22px">${inner}</td></tr></table>`

export const divider = () =>
  `<tr><td style="padding:0 40px"><div style="height:1px;line-height:1px;font-size:1px;background:${COLORS.line}">&nbsp;</div></td></tr>`

// Pasos del pedido. Los completos y el actual van en violeta y el actual lleva un punto magenta con
// halo; los pendientes quedan apagados. Cada paso dibuja su tramo de línea a ambos lados del punto.
export const stepper = (steps: string[], current: number) => {
  const line = (on: boolean, visible: boolean) =>
    `<td width="50%" valign="middle" style="padding:0">${
      visible
        ? `<div style="height:2px;line-height:2px;font-size:0;background:${on ? COLORS.violet : COLORS.line}">&nbsp;</div>`
        : "&nbsp;"
    }</td>`

  const cells = steps
    .map((step, index) => {
      const done = index < current
      const active = index === current
      const dot = done ? COLORS.violet : active ? COLORS.magenta : COLORS.line
      const text = done || active ? COLORS.text : COLORS.faint
      const halo = active ? `border:4px solid rgba(255,43,214,0.28);` : ""
      return `<td align="center" valign="top" style="width:${Math.floor(100 / steps.length)}%;padding:0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          ${line(index <= current, index > 0)}
          <td align="center" valign="middle" style="width:22px;height:22px;padding:0"><div style="width:14px;height:14px;line-height:14px;font-size:0;border-radius:50%;background:${dot};${halo}margin:${active ? 0 : 4}px auto">&nbsp;</div></td>
          ${line(index < current, index < steps.length - 1)}
        </tr></table>
        <div style="padding-top:12px;font-family:${FONT};font-size:12px;line-height:1.35;color:${text};font-weight:${active ? 700 : 400}">${esc(step)}</div>
      </td>`
    })
    .join("")
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>`
}

export const logo = () =>
  `<span style="font-family:${DISPLAY};font-size:24px;font-weight:700;letter-spacing:5px;text-transform:uppercase;color:${COLORS.text}">CYPRO<span style="color:${COLORS.violet}">TECH</span></span>`

export type LayoutInput = {
  preheader: string
  title: string
  body: string
  brand: Brand
}

export const layout = ({ preheader, title, body, brand }: LayoutInput) => `<!doctype html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${esc(title)}</title>
<style>
  body{margin:0;padding:0;background:${COLORS.page};-webkit-text-size-adjust:100%}
  a{color:${COLORS.violet}}
  @media only screen and (max-width:620px){
    .container{width:100%!important}
    .px{padding-left:22px!important;padding-right:22px!important}
    .stack{display:block!important;width:100%!important}
    .stack-gap{padding-top:14px!important}
    h1{font-size:26px!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${COLORS.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLORS.page}">${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.page}" style="background:${COLORS.page}">
<tr><td align="center" style="padding:32px 12px">
  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px">
    <tr><td align="center" style="padding:0 0 22px">${logo()}</td></tr>
    <tr><td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.card}" style="background:${COLORS.card};border:1px solid ${COLORS.line};border-radius:20px;overflow:hidden">
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="34%" style="height:4px;line-height:4px;font-size:1px;background:${COLORS.violetDeep}">&nbsp;</td>
            <td width="33%" style="height:4px;line-height:4px;font-size:1px;background:${COLORS.magenta}">&nbsp;</td>
            <td width="33%" style="height:4px;line-height:4px;font-size:1px;background:${COLORS.cyan}">&nbsp;</td>
          </tr></table>
        </td></tr>
        ${body}
      </table>
    </td></tr>
    <tr><td align="center" style="padding:28px 24px 0">
      <p style="margin:0 0 6px;font-family:${FONT};font-size:13px;line-height:1.6;color:${COLORS.faint}">¿Dudas con tu pedido? Escríbenos a <a href="mailto:${esc(brand.supportEmail)}" style="color:${COLORS.violet};text-decoration:none">${esc(brand.supportEmail)}</a></p>
      <p style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:1.6;color:${COLORS.faint}">© ${new Date().getFullYear()} ${esc(brand.name)}. Todos los derechos reservados.</p>
      <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${COLORS.faint}">Plataforma desarrollada por <a href="${esc(brand.developerUrl)}" style="color:${COLORS.violet};text-decoration:none">${esc(brand.developerName)}</a></p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`

// Fila de contenido con el relleno estándar del correo.
export const row = (inner: string, padding = "0 40px") =>
  `<tr><td class="px" style="padding:${padding}">${inner}</td></tr>`
