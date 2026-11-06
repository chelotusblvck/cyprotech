import type { EmissionRequest } from "../dte"
import { OpenFacturaClient } from "../client/client"
import { createOpenFacturaApi, MockOpenFacturaClient, UnconfiguredOpenFacturaClient } from "../client"
import { DteServiceClient, loadDteServiceConfig } from "../client/dte-service"

const config = { baseUrl: "https://dte.garage360.cl", token: "token-del-sitio-de-prueba-0001", timeoutMs: 5_000 }

type Call = { url: string; init: RequestInit }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

// fetch simulado: responde lo que indique el guion y guarda las llamadas.
const fakeFetch = (script: (call: Call) => Response | Promise<Response>) => {
  const calls: Call[] = []
  const impl = (async (url: string, init: RequestInit) => {
    const call = { url, init }
    calls.push(call)
    return script(call)
  }) as unknown as typeof fetch
  return { calls, impl }
}

const boleta = (overrides: Record<string, unknown> = {}): EmissionRequest => ({
  response: ["FOLIO"],
  dte: {
    Encabezado: {
      IdDoc: { TipoDTE: 39, Folio: 0 },
      Receptor: { RUTRecep: "66666666-6" },
      Totales: { MntTotal: 374360 },
    },
    Detalle: [
      { NroLinDet: 1, NmbItem: "Tarjeta de video", QtyItem: 1, PrcItem: 371460, MontoItem: 371460 },
      { NroLinDet: 2, NmbItem: "Despacho", QtyItem: 1, PrcItem: 2900, MontoItem: 2900 },
    ],
    ...overrides,
  },
})

const ok = { folio: 12, total: 374360, codigo: "6b639b709e3806da" }

describe("loadDteServiceConfig", () => {
  it("devuelve null si falta la dirección o el token", () => {
    expect(loadDteServiceConfig({})).toBeNull()
    expect(loadDteServiceConfig({ DTE_SERVICE_URL: "https://x.cl" })).toBeNull()
    expect(loadDteServiceConfig({ DTE_SERVICE_TOKEN: "t" })).toBeNull()
  })

  it("quita la barra final y usa 30 segundos por defecto", () => {
    expect(loadDteServiceConfig({ DTE_SERVICE_URL: "https://dte.garage360.cl/", DTE_SERVICE_TOKEN: " abc " })).toEqual({
      baseUrl: "https://dte.garage360.cl",
      token: "abc",
      timeoutMs: 30_000,
    })
  })
})

describe("createOpenFacturaApi", () => {
  it("usa el servicio de boletas si están la dirección y el token, aunque haya API key de OpenFactura", () => {
    const api = createOpenFacturaApi({ DTE_SERVICE_URL: "https://x.cl", DTE_SERVICE_TOKEN: "t", OPENFACTURA_API_KEY: "k" } as never)
    expect(api).toBeInstanceOf(DteServiceClient)
  })

  it("sin el servicio sigue funcionando como antes", () => {
    expect(createOpenFacturaApi({ OPENFACTURA_API_KEY: "k" } as never)).toBeInstanceOf(OpenFacturaClient)
    expect(createOpenFacturaApi({ NODE_ENV: "production" } as never)).toBeInstanceOf(UnconfiguredOpenFacturaClient)
    expect(createOpenFacturaApi({} as never)).toBeInstanceOf(MockOpenFacturaClient)
  })
})

describe("DteServiceClient.emit", () => {
  it("envía las líneas con la clave de idempotencia como referencia y devuelve folio y token folio-código", async () => {
    const { calls, impl } = fakeFetch(() => json(ok, 201))
    const result = await new DteServiceClient(config, impl).emit(boleta(), "order_01ABC-boleta")

    expect(result).toEqual({ token: "12-6b639b709e3806da", folio: 12, resolucion: null })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe("https://dte.garage360.cl/v1/boletas")
    expect(calls[0].init.method).toBe("POST")
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer token-del-sitio-de-prueba-0001")
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      referencia: "order_01ABC-boleta",
      items: [
        { nombre: "Tarjeta de video", cantidad: 1, precioUnitario: 371460 },
        { nombre: "Despacho", cantidad: 1, precioUnitario: 2900 },
      ],
    })
  })

  it("el folio solo nunca es el token público: lleva el código de consulta", async () => {
    const { impl } = fakeFetch(() => json(ok))
    const { token } = await new DteServiceClient(config, impl).emit(boleta(), "k")
    expect(token).toMatch(/^\d+-[0-9a-f]{16}$/)
  })

  it("informa el RUT y el nombre del cliente solo si no es consumidor final", async () => {
    const { calls, impl } = fakeFetch(() => json(ok))
    const cliente = boleta()
    cliente.dte.Encabezado = {
      ...(cliente.dte.Encabezado as object),
      Receptor: { RUTRecep: "17818540-3", RznSocRecep: "MARCELO CEPEDA" },
    } as never
    await new DteServiceClient(config, impl).emit(cliente, "k")
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({ receptorRut: "17818540-3", receptorNombre: "MARCELO CEPEDA" })

    const anonimo = fakeFetch(() => json(ok))
    await new DteServiceClient(config, anonimo.impl).emit(boleta(), "k")
    expect(JSON.parse(anonimo.calls[0].init.body as string)).not.toHaveProperty("receptorRut")
  })

  it("reemplaza lo que no cabe en ISO-8859-1 y recorta a 80 caracteres, en vez de rechazar la venta", async () => {
    const { calls, impl } = fakeFetch(() => json(ok))
    const request = boleta({
      Detalle: [{ NmbItem: `Teclado 🎮 gamer € ${"x".repeat(100)}`, QtyItem: 1, PrcItem: 374360 }],
    })
    await new DteServiceClient(config, impl).emit(request, "k")
    const nombre = JSON.parse(calls[0].init.body as string).items[0].nombre as string
    expect(nombre.startsWith("Teclado ? gamer ? ")).toBe(true)
    expect(nombre.length).toBeLessThanOrEqual(80)
  })

  it("una factura no se emite por el servicio: falla sin reintento y sin llamar", async () => {
    const { calls, impl } = fakeFetch(() => json(ok))
    const factura = boleta()
    ;(factura.dte.Encabezado as { IdDoc: { TipoDTE: number } }).IdDoc.TipoDTE = 33
    const error = await new DteServiceClient(config, impl).emit(factura, "k").catch((e) => e)
    expect(error.status).toBe(422)
    expect(error.retryable).toBe(false)
    expect(error.message).toMatch(/solo emite boletas/)
    expect(calls).toHaveLength(0)
  })

  it("si la boleta del servicio no suma lo cobrado, corta para revisión manual", async () => {
    const { impl } = fakeFetch(() => json({ ...ok, total: 374361 }))
    const error = await new DteServiceClient(config, impl).emit(boleta(), "k").catch((e) => e)
    expect(error.status).toBe(422)
    expect(error.retryable).toBe(false)
    expect(error.message).toMatch(/Revisar a mano/)
  })

  it("un servicio sin código de consulta (versión vieja) no se acepta", async () => {
    const { impl } = fakeFetch(() => json({ folio: 12, total: 374360 }))
    const error = await new DteServiceClient(config, impl).emit(boleta(), "k").catch((e) => e)
    expect(error.retryable).toBe(false)
    expect(error.message).toMatch(/código de consulta/)
  })

  it("datos inválidos (400), token malo (401) y conflicto (409) no se reintentan, y el mensaje es el del servicio", async () => {
    for (const status of [400, 401, 409]) {
      const { impl } = fakeFetch(() => json({ error: { codigo: "x", mensaje: `mensaje ${status}` } }, status))
      const error = await new DteServiceClient(config, impl).emit(boleta(), "k").catch((e) => e)
      expect(error.status).toBe(status)
      expect(error.retryable).toBe(false)
      expect(error.message).toBe(`mensaje ${status}`)
    }
  })

  it("sin folios (503), error del servidor (500) y límite (429) se reintentan", async () => {
    for (const status of [503, 500, 429]) {
      const { impl } = fakeFetch(() => json({ error: { codigo: "sin_folios", mensaje: "No quedan folios" } }, status))
      const error = await new DteServiceClient(config, impl).emit(boleta(), "k").catch((e) => e)
      expect(error.retryable).toBe(true)
    }
  })

  it("un corte de red se reintenta y lo dice", async () => {
    const impl = (async () => {
      throw new TypeError("fetch failed")
    }) as unknown as typeof fetch
    const error = await new DteServiceClient(config, impl).emit(boleta(), "k").catch((e) => e)
    expect(error.status).toBe(503)
    expect(error.retryable).toBe(true)
    expect(error.message).toMatch(/No se pudo conectar con el servicio de boletas/)
  })
})

describe("DteServiceClient.getStatus y getPdf", () => {
  it("traduce el estado del servicio al del SII", async () => {
    const cases: [string, string][] = [
      ["FIRMADO", "Pendiente"],
      ["ENVIADO", "Pendiente"],
      ["ACEPTADO", "Aceptado"],
      ["RECHAZADO", "Rechazado"],
    ]
    for (const [estado, esperado] of cases) {
      const { calls, impl } = fakeFetch(() => json({ estado }))
      expect(await new DteServiceClient(config, impl).getStatus("12-6b639b709e3806da")).toBe(esperado)
      expect(calls[0].url).toBe("https://dte.garage360.cl/v1/boletas/12")
    }
  })

  it("rechaza un token que no tiene la forma folio-código, sin llamar al servicio", async () => {
    const { calls, impl } = fakeFetch(() => json({ estado: "ACEPTADO" }))
    const client = new DteServiceClient(config, impl)
    for (const token of ["12", "abc", "12-zzz", "../../etc/passwd", "12-6b639b709e3806da/../x"]) {
      await expect(client.getStatus(token)).rejects.toMatchObject({ status: 404 })
      await expect(client.getPdf(token)).rejects.toMatchObject({ status: 404 })
    }
    expect(calls).toHaveLength(0)
  })

  it("descarga el PDF por folio", async () => {
    const pdf = Buffer.from("%PDF-1.4 prueba")
    const { calls, impl } = fakeFetch(() => new Response(pdf, { status: 200, headers: { "content-type": "application/pdf" } }))
    const result = await new DteServiceClient(config, impl).getPdf("12-6b639b709e3806da")
    expect(result.equals(pdf)).toBe(true)
    expect(calls[0].url).toBe("https://dte.garage360.cl/v1/boletas/12/pdf")
  })

  it("reintenta el PDF ante un corte pasajero, pero no ante un 404", async () => {
    let n = 0
    const retry = fakeFetch(() => (++n < 3 ? json({}, 503) : new Response(Buffer.from("%PDF"), { status: 200 })))
    expect((await new DteServiceClient(config, retry.impl).getPdf("12-6b639b709e3806da")).toString()).toBe("%PDF")
    expect(retry.calls).toHaveLength(3)

    const missing = fakeFetch(() => json({ error: { mensaje: "No existe" } }, 404))
    await expect(new DteServiceClient(config, missing.impl).getPdf("12-6b639b709e3806da")).rejects.toMatchObject({ status: 404 })
    expect(missing.calls).toHaveLength(1)
  })
})

describe("DteServiceClient: anulación", () => {
  it("anula con una solicitud al servicio, no con una nota de crédito por API", async () => {
    const client = new DteServiceClient(config, fakeFetch(() => json({ instrucciones: "Emitir la nota en el portal" })).impl)
    expect(client.cancellation).toBe("manual")
    expect(client.issuerManagedRemotely).toBe(true)
    expect(await client.requestCancellation(12, "Devolución")).toEqual({ instructions: "Emitir la nota en el portal" })
  })

  it("envía el motivo al servicio y confirma con el folio de la nota", async () => {
    const { calls, impl } = fakeFetch(() => json({ instrucciones: "x", anulacion: {} }))
    const client = new DteServiceClient(config, impl)
    await client.requestCancellation(12, "El cliente devolvió el producto")
    await client.confirmCancellation(12, 7701, "2026-11-07")
    await client.confirmCancellation(12, 7701)

    expect(calls[0].url).toBe("https://dte.garage360.cl/v1/boletas/12/anulacion")
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ motivo: "El cliente devolvió el producto" })
    expect(calls[1].url).toBe("https://dte.garage360.cl/v1/boletas/12/anulacion/emitida")
    expect(JSON.parse(calls[1].init.body as string)).toEqual({ folioNotaCredito: 7701, fecha: "2026-11-07" })
    expect(JSON.parse(calls[2].init.body as string)).toEqual({ folioNotaCredito: 7701 })
  })

  it("un conflicto al confirmar (otra nota ya registrada) es un error claro y no se reintenta", async () => {
    const { impl } = fakeFetch(() => json({ error: { codigo: "conflicto", mensaje: "Esa boleta ya fue anulada con la Nota de Credito 7701" } }, 409))
    const error = await new DteServiceClient(config, impl).confirmCancellation(12, 9999).catch((e) => e)
    expect(error.status).toBe(409)
    expect(error.retryable).toBe(false)
    expect(error.message).toMatch(/ya fue anulada/)
  })
})
