const clpFormat = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
})

// El signo va antes del símbolo: -$20.159 (Intl pone "$-20.159" en es-CL).
export const clp = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return "-"
  }
  const rounded = Math.round(value)
  return `${rounded < 0 ? "-" : ""}${clpFormat.format(Math.abs(rounded))}`
}

export const percent = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined ? "-" : `${value.toFixed(digits).replace(".", ",")}%`

export const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", timeZone: "America/Santiago" }).format(
    new Date(iso),
  )

export const dateTime = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat("es-CL", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Santiago",
      }).format(new Date(iso))
    : "-"

// "2026-10" -> "octubre 2026"
export const periodLabel = (period: string) => {
  const [year, month] = period.split("-").map(Number)
  const name = new Intl.DateTimeFormat("es-CL", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
  return `${name} ${year}`
}
