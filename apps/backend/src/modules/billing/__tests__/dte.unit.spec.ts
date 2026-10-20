import {
  buildBoleta,
  buildCreditNote,
  buildFactura,
  clean,
  documentRequestFrom,
  emissionDate,
  linesFromOrder,
  netLines,
  receptorFrom,
  totalsFromGross,
} from "../dte"
import { CONSUMIDOR_FINAL, parseRut } from "../rut"
import type { Emisor, OrderForBilling } from "../types"

const emisor: Emisor = {
  rut: "76795561-8",
  razonSocial: "Garage360 SpA",
  giro: "Venta al por menor por internet",
  acteco: 479100,
  direccion: "Av. Ejemplo 123",
  comuna: "Providencia",
  codigoSucursal: "81303347",
}

const order: OrderForBilling = {
  id: "order_1",
  display_id: 12,
  created_at: "2026-10-20T15:00:00Z",
  total: 374360,
  shipping_total: 2900,
  items: [
    { product_title: "Tarjeta de video MSI GeForce RTX 4060", quantity: 1, unit_price: 371460, total: 371460 },
  ],
}

describe("RUT", () => {
  it.each([
    ["12.345.678-5", "12345678-5"],
    ["12345678-5", "12345678-5"],
    ["123456785", "12345678-5"],
    ["7.025.521-9", "7025521-9"],
    ["76.430.498-5", "76430498-5"],
    ["10.000.013-K", "10000013-K"],
  ])("%s es válido", (input, expected) => {
    expect(parseRut(input)?.formatted).toBe(expected)
  })

  it.each(["12.345.678-9", "1234", "abcdefgh-1", "", "12345678-K"])("%s no es válido", (input) => {
    expect(parseRut(input)).toBeNull()
  })

  it("el RUT genérico de consumidor final tiene un formato válido para el SII", () => {
    expect(CONSUMIDOR_FINAL).toBe("66666666-6")
  })
})

describe("clean / fecha", () => {
  it("quita espacios dobles y saltos de línea y respeta el largo máximo", () => {
    expect(clean("  Mouse   gamer\n inalámbrico ")).toBe("Mouse gamer inalámbrico")
    expect(clean("x".repeat(200))).toHaveLength(80)
    expect(clean(null)).toBe("")
  })

  it("la fecha de emisión es la de Chile, no la UTC", () => {
    expect(emissionDate(new Date("2026-11-01T02:00:00Z"))).toBe("2026-10-31")
    expect(emissionDate(new Date("2026-11-01T12:00:00Z"))).toBe("2026-11-01")
  })
})

describe("documentRequestFrom", () => {
  it("por defecto emite boleta", () => {
    expect(documentRequestFrom(null)).toEqual({ type: "boleta", rut: undefined })
    expect(documentRequestFrom({})).toEqual({ type: "boleta", rut: undefined })
  })

  it("usa el RUT del cliente en la boleta si es válido y lo ignora si no", () => {
    expect(documentRequestFrom({ rut: "12.345.678-5" })).toEqual({ type: "boleta", rut: "12345678-5" })
    expect(documentRequestFrom({ rut: "12.345.678-9" })).toEqual({ type: "boleta", rut: undefined })
  })

  it("arma la factura cuando vienen todos los datos y el RUT es válido", () => {
    const request = documentRequestFrom({
      document: {
        type: "factura",
        rut: "76.430.498-5",
        razonSocial: "Hosty SpA",
        giro: "Servicios informáticos",
        direccion: "Arturo Prat 527",
        comuna: "Curicó",
      },
    })
    expect(request).toMatchObject({ type: "factura", rut: "76430498-5", razonSocial: "Hosty SpA", comuna: "Curicó" })
  })

  it("si la factura viene incompleta o con RUT inválido, cae a boleta en vez de bloquear la venta", () => {
    expect(documentRequestFrom({ document: { type: "factura", rut: "76.430.498-5", razonSocial: "Hosty" } }).type).toBe("boleta")
    expect(
      documentRequestFrom({
        document: { type: "factura", rut: "76.430.498-0", razonSocial: "H", giro: "g", direccion: "d", comuna: "c" },
      }).type,
    ).toBe("boleta")
  })
})

describe("linesFromOrder", () => {
  it("incluye los productos y el despacho", () => {
    const lines = linesFromOrder(order)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ quantity: 1, unitPrice: 371460, total: 371460 })
    expect(lines[1]).toMatchObject({ name: "Despacho", total: 2900 })
    expect(lines.reduce((sum, line) => sum + line.total, 0)).toBe(374360)
  })

  it("mantiene cantidad y precio unitario cuando dividen exacto", () => {
    const lines = linesFromOrder({ ...order, total: 258100, items: [{ title: "Mouse", quantity: 2, unit_price: 128600, total: 257200 }], shipping_total: 900 })
    expect(lines[0]).toMatchObject({ quantity: 2, unitPrice: 128600, total: 257200 })
  })

  it("con un descuento que no divide exacto emite una sola unidad con el total real", () => {
    const lines = linesFromOrder({
      ...order,
      total: 100001,
      shipping_total: 0,
      items: [{ title: "Cable", quantity: 3, unit_price: 40000, total: 100001 }],
    })
    expect(lines[0]).toMatchObject({ quantity: 1, unitPrice: 100001, total: 100001 })
    expect(lines[0].name).toContain("x3")
  })

  it("absorbe una diferencia de hasta $3 en la última línea", () => {
    const lines = linesFromOrder({ ...order, total: 374362 })
    expect(lines.reduce((sum, line) => sum + line.total, 0)).toBe(374362)
  })

  it("rechaza un pedido cuyas líneas no calzan con lo cobrado", () => {
    expect(() => linesFromOrder({ ...order, total: 380000 })).toThrow(/no calzan/)
  })
})

describe("totales", () => {
  it("el neto se redondea y el IVA es la diferencia, así la suma siempre calza", () => {
    expect(totalsFromGross(119000)).toEqual({ neto: 100000, iva: 19000, total: 119000 })
    const odd = totalsFromGross(374360)
    expect(odd.neto + odd.iva).toBe(374360)
    expect(odd.neto).toBe(314588)
  })

  it("las líneas netas de una factura suman exactamente el neto", () => {
    const lines = linesFromOrder(order)
    const { neto } = totalsFromGross(order.total)
    const net = netLines(lines, neto)
    expect(net.reduce((sum, line) => sum + line.total, 0)).toBe(neto)
  })
})

describe("buildBoleta", () => {
  const request = buildBoleta({ lines: linesFromOrder(order), total: order.total, emisor, date: new Date("2026-10-20T15:00:00Z") })
  const encabezado = (request.dte as { Encabezado: Record<string, Record<string, unknown>> }).Encabezado

  it("usa los nombres de campo propios de la boleta y consumidor final por defecto", () => {
    expect(encabezado.IdDoc).toMatchObject({ TipoDTE: 39, Folio: 0, FchEmis: "2026-10-20", IndServicio: "3" })
    expect(encabezado.Emisor).toMatchObject({
      RUTEmisor: "76795561-8",
      RznSocEmisor: "GARAGE360 SPA",
      GiroEmisor: "VENTA AL POR MENOR POR INTERNET",
      CdgSIISucur: "81303347",
      CmnaOrigen: "Providencia",
    })
    expect(encabezado.Receptor).toEqual({ RUTRecep: "66666666-6" })
  })

  it("los totales calzan con lo cobrado y el IVA es el 19% incluido", () => {
    expect(encabezado.Totales).toEqual({
      MntNeto: 314588,
      IVA: 59772,
      MntTotal: 374360,
      TotalPeriodo: 374360,
      VlrPagar: 374360,
    })
  })

  it("las líneas de la boleta van con IVA y numeradas", () => {
    const detalle = (request.dte as { Detalle: Record<string, unknown>[] }).Detalle
    expect(detalle.map((line) => line.NroLinDet)).toEqual([1, 2])
    expect(detalle[0]).toMatchObject({ QtyItem: 1, PrcItem: 371460, MontoItem: 371460 })
  })

  it("incluye el RUT y el nombre del cliente cuando los entregó", () => {
    const withRut = buildBoleta({
      lines: linesFromOrder(order),
      total: order.total,
      emisor,
      receptorRut: "12345678-5",
      receptorName: "Ana Pérez",
      date: new Date(),
    })
    const receptor = (withRut.dte as { Encabezado: { Receptor: Record<string, unknown> } }).Encabezado.Receptor
    expect(receptor).toEqual({ RUTRecep: "12345678-5", RznSocRecep: "ANA PÉREZ" })
  })

  it("pide folio, resolución y nada de PDF (se genera al descargar)", () => {
    expect(request.response).toEqual(["FOLIO", "RESOLUCION"])
  })
})

describe("buildFactura", () => {
  const request = buildFactura({
    lines: linesFromOrder(order),
    total: order.total,
    emisor,
    receptor: {
      rut: "76430498-5",
      razonSocial: "Hosty SpA",
      giro: "Servicios informáticos",
      direccion: "Arturo Prat 527",
      comuna: "Curicó",
    },
    date: new Date("2026-10-20T15:00:00Z"),
  })
  const dte = request.dte as { Encabezado: Record<string, Record<string, unknown>>; Detalle: Record<string, number>[] }

  it("usa los campos de factura y los datos del receptor", () => {
    expect(dte.Encabezado.IdDoc).toMatchObject({ TipoDTE: 33, Folio: 0, FmaPago: "1" })
    expect(dte.Encabezado.Emisor).toMatchObject({ RznSoc: "GARAGE360 SPA", GiroEmis: "VENTA AL POR MENOR POR INTERNET", Acteco: 479100 })
    expect(dte.Encabezado.Receptor).toMatchObject({ RUTRecep: "76430498-5", RznSocRecep: "HOSTY SPA", CmnaRecep: "Curicó" })
  })

  it("las líneas van en neto y suman el neto del documento", () => {
    const total = dte.Detalle.reduce((sum, line) => sum + line.MontoItem, 0)
    expect(total).toBe((dte.Encabezado.Totales as { MntNeto: number }).MntNeto)
    expect(dte.Encabezado.Totales).toMatchObject({ MntNeto: 314588, TasaIVA: "19", IVA: 59772, MntTotal: 374360 })
  })
})

describe("buildCreditNote", () => {
  const request = buildCreditNote({
    original: { type: 39, folio: 109, date: "2026-10-20", lines: linesFromOrder(order), total: order.total },
    emisor,
    reason: "Anula boleta por devolución",
    date: new Date("2026-10-25T15:00:00Z"),
  })
  const dte = request.dte as { Encabezado: Record<string, Record<string, unknown>>; Referencia: Record<string, unknown>[] }

  it("referencia el documento original por tipo, folio y fecha y lo anula", () => {
    expect(dte.Encabezado.IdDoc).toMatchObject({ TipoDTE: 61 })
    expect(dte.Referencia).toEqual([
      { NroLinRef: 1, TpoDocRef: "39", FolioRef: "109", FchRef: "2026-10-20", CodRef: 1, RazonRef: "Anula boleta por devolución" },
    ])
  })

  it("repite los montos del documento original", () => {
    expect(dte.Encabezado.Totales).toMatchObject({ MntNeto: 314588, IVA: 59772, MntTotal: 374360 })
  })

  it("usa consumidor final si el original no tenía receptor", () => {
    expect(dte.Encabezado.Receptor).toMatchObject({ RUTRecep: "66666666-6" })
  })
})

describe("receptorFrom", () => {
  it("entrega el receptor de la factura o el RUT de la boleta", () => {
    expect(receptorFrom({ type: "boleta" })).toBeNull()
    expect(receptorFrom({ type: "boleta", rut: "12345678-5" }, "Ana")).toEqual({ rut: "12345678-5", razonSocial: "Ana" })
    expect(
      receptorFrom({ type: "factura", rut: "76430498-5", razonSocial: "H", giro: "g", direccion: "d", comuna: "c" }),
    ).toMatchObject({ rut: "76430498-5", razonSocial: "H" })
  })
})
