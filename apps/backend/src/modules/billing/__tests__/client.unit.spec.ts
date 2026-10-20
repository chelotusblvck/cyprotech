import { OpenFacturaClient, OpenFacturaError } from "../client/client"
import { loadEmisor, loadOpenFacturaConfig } from "../client/config"
import { createOpenFacturaApi } from "../client"
import { MockOpenFacturaClient } from "../client/mock"
import { buildSimplePdf } from "../client/simple-pdf"

const config = { apiKey: "KEY", environment: "dev" as const, baseUrl: "https://dev-api.haulmer.com", timeoutMs: 1000 }
const request = { response: ["FOLIO"], dte: { Encabezado: { IdDoc: { TipoDTE: 39 } }, Detalle: [] } }
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

const client = (fetchMock: jest.Mock) => new OpenFacturaClient(config, fetchMock as unknown as typeof fetch)

describe("configuración", () => {
  it("sin API Key no hay configuración real y se usa el simulado", () => {
    expect(loadOpenFacturaConfig({} as NodeJS.ProcessEnv)).toBeNull()
    expect(createOpenFacturaApi({} as NodeJS.ProcessEnv).isMock).toBe(true)
  })

  it("usa el ambiente de desarrollo por defecto y producción solo si se pide", () => {
    const base = { OPENFACTURA_API_KEY: "k" } as unknown as NodeJS.ProcessEnv
    expect(loadOpenFacturaConfig(base)?.baseUrl).toBe("https://dev-api.haulmer.com")
    expect(loadOpenFacturaConfig({ ...base, OPENFACTURA_ENV: "production" } as unknown as NodeJS.ProcessEnv)?.baseUrl).toBe(
      "https://api.haulmer.com",
    )
    expect(createOpenFacturaApi(base).isMock).toBe(false)
  })

  it("el emisor exige todos los datos tributarios", () => {
    const env = {
      BILLING_EMISOR_RUT: "76795561-8",
      BILLING_EMISOR_RAZON_SOCIAL: "Garage360 SpA",
      BILLING_EMISOR_GIRO: "Venta por internet",
      BILLING_EMISOR_ACTECO: "479100",
      BILLING_EMISOR_DIRECCION: "Av. Ejemplo 1",
      BILLING_EMISOR_COMUNA: "Providencia",
    } as unknown as NodeJS.ProcessEnv
    expect(loadEmisor(env)).toMatchObject({ rut: "76795561-8", acteco: 479100 })
    expect(loadEmisor({ ...env, BILLING_EMISOR_GIRO: "" } as unknown as NodeJS.ProcessEnv)).toBeNull()
    expect(loadEmisor({ ...env, BILLING_EMISOR_ACTECO: "abc" } as unknown as NodeJS.ProcessEnv)).toBeNull()
    expect(loadEmisor({} as NodeJS.ProcessEnv)).toBeNull()
  })
})

describe("OpenFacturaClient", () => {
  it("emite con apikey e Idempotency-Key y devuelve folio y token", async () => {
    const fetchMock = jest.fn().mockResolvedValue(json({ TOKEN: "TOK", FOLIO: 109, RESOLUCION: { fecha: "2018-03-26", numero: 0 } }))
    const result = await client(fetchMock).emit(request, "order-1-boleta")

    expect(result).toEqual({ token: "TOK", folio: 109, resolucion: { fecha: "2018-03-26", numero: 0 } })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://dev-api.haulmer.com/v2/dte/document")
    expect(init.method).toBe("POST")
    expect(init.headers.apikey).toBe("KEY")
    expect(init.headers["Idempotency-Key"]).toBe("order-1-boleta")
    expect(JSON.parse(init.body)).toEqual(request)
  })

  it("un reintento con la misma clave recupera el documento original en vez de fallar", async () => {
    const fetchMock = jest
      .fn()
      // Respuesta real de OpenFactura: el token llega en details.
      .mockResolvedValueOnce(
        json(
          {
            error: {
              message: "Este DTE ya fue emitido (Idempotency-Key)",
              code: "OF-06",
              details: [{ field: "token", issue: "TOKEN-ORIGINAL" }],
            },
          },
          400,
        ),
      )
      .mockResolvedValueOnce(json({ json: { Encabezado: { IdDoc: { Folio: "711111" } } } }))

    const result = await client(fetchMock).emit(request, "order-1-boleta")
    expect(result).toEqual({ token: "TOKEN-ORIGINAL", folio: 711111, resolucion: null })
    expect(fetchMock.mock.calls[1][0]).toBe("https://dev-api.haulmer.com/v2/dte/document/TOKEN-ORIGINAL/json")
  })

  it("también reconoce el token cuando viene en error.token", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(json({ error: { message: "Este DTE ya fue emitido (Idempotency-Key)", code: "OF-06", token: "T2" } }, 400))
      .mockResolvedValueOnce(json({ json: '{"Encabezado":{"IdDoc":{"Folio":5}}}' }))
    expect((await client(fetchMock).emit(request, "k")).token).toBe("T2")
  })

  it("un error de validación informa cada campo y no se considera reintentable", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      json({ error: { message: "Validación de Campos", code: "OF-10", details: [{ field: "MntNeto", issue: "Monto erróneo : 1000" }] } }, 400),
    )
    const error = await client(fetchMock).emit(request, "k").catch((e) => e)
    expect(error).toBeInstanceOf(OpenFacturaError)
    expect(error.message).toBe("Validación de Campos - MntNeto: Monto erróneo : 1000")
    expect(error.code).toBe("OF-10")
    expect(error.retryable).toBe(false)
  })

  it("el límite de peticiones y los errores de servicio sí son reintentables", async () => {
    const limited = await client(jest.fn().mockResolvedValue(json({ message: "API rate limit exceeded" }, 429))).emit(request, "k").catch((e) => e)
    expect(limited.retryable).toBe(true)
    const down = await client(jest.fn().mockResolvedValue(json({}, 503))).emit(request, "k").catch((e) => e)
    expect(down.retryable).toBe(true)
  })

  it("lee el estado del SII del campo estado", async () => {
    const fetchMock = jest.fn().mockResolvedValue(json({ estado: "Aceptado", token: "T" }))
    expect(await client(fetchMock).getStatus("T")).toBe("Aceptado")
    expect(fetchMock.mock.calls[0][0]).toBe("https://dev-api.haulmer.com/v2/dte/document/T/status")
  })

  it("descarga el PDF decodificando el base64", async () => {
    const fetchMock = jest.fn().mockResolvedValue(json({ pdf: Buffer.from("%PDF-1.4 demo").toString("base64") }))
    const pdf = await client(fetchMock).getPdf("T")
    expect(pdf.toString()).toBe("%PDF-1.4 demo")
  })
})

describe("emisor simulado", () => {
  it("da folios correlativos por tipo y respeta la idempotencia", async () => {
    const mock = new MockOpenFacturaClient()
    const a = await mock.emit(request, "mock-a")
    const b = await mock.emit(request, "mock-b")
    const again = await mock.emit(request, "mock-a")
    expect(b.folio).toBe(a.folio + 1)
    expect(again).toMatchObject({ token: a.token, folio: a.folio })
  })

  it("genera un PDF de prueba y marca el documento como aceptado", async () => {
    const mock = new MockOpenFacturaClient()
    const full = {
      response: ["FOLIO"],
      dte: {
        Encabezado: {
          IdDoc: { TipoDTE: 39, FchEmis: "2026-10-20" },
          Receptor: { RUTRecep: "66666666-6" },
          Totales: { MntTotal: 1000 },
        },
        Detalle: [{ NmbItem: "Mouse", QtyItem: 1, MontoItem: 1000 }],
      },
    }
    const { token } = await mock.emit(full, "mock-pdf")
    const pdf = await mock.getPdf(token)
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
    expect(pdf.toString("latin1")).toContain("SIN VALIDEZ TRIBUTARIA")
    expect(await mock.getStatus(token)).toBe("Aceptado")
    expect(await mock.getStatus("otro")).toBe("Rechazado")
  })

  it("el PDF mínimo es estructuralmente válido (xref apunta a cada objeto)", () => {
    const pdf = buildSimplePdf(["Línea (con) paréntesis \\ y barra"]).toString("latin1")
    const startxref = Number(/startxref\n(\d+)/.exec(pdf)?.[1])
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref")
    for (const match of pdf.matchAll(/(\d{10}) 00000 n/g)) {
      expect(pdf.slice(Number(match[1])).startsWith(`${[...pdf.matchAll(/(\d{10}) 00000 n/g)].findIndex((m) => m[1] === match[1]) + 1} 0 obj`)).toBe(true)
    }
  })
})
