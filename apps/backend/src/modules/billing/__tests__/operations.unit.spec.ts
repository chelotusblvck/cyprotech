import { OpenFacturaError } from "../client/client"
import { MockOpenFacturaClient } from "../client/mock"
import type { OpenFacturaApi } from "../client/types"
import {
  MAX_ATTEMPTS,
  SAFE_RETRY_WINDOW_MS,
  issueCreditNote,
  issueDocument,
  pollSiiStatus,
  retryFailed,
  type BillingDeps,
} from "../operations"
import type { Emisor, OrderForBilling } from "../types"

const emisor: Emisor = {
  rut: "76795561-8",
  razonSocial: "Garage360 SpA",
  giro: "Venta por internet",
  acteco: 479100,
  direccion: "Av. Ejemplo 1",
  comuna: "Providencia",
}

// Servicio en memoria con la misma forma que el generado por MedusaService.
const makeService = () => {
  let seq = 0
  const rows: Record<string, unknown>[] = []
  const matches = (row: Record<string, unknown>, filters: Record<string, unknown> = {}) =>
    Object.entries(filters).every(([key, value]) => (Array.isArray(value) ? value.includes(row[key]) : row[key] === value))
  return {
    rows,
    service: {
      listBillingDocuments: async (filters?: Record<string, unknown>) => rows.filter((row) => matches(row, filters)),
      createBillingDocuments: async (data: Record<string, unknown>) => {
        const row = { id: `bild_${++seq}`, state: "pending", retryable: true, attempts: 0, ...data }
        rows.push(row)
        return row
      },
      updateBillingDocuments: async (data: Record<string, unknown>) => {
        const row = rows.find((item) => item.id === data.id)
        Object.assign(row as object, data)
        return row
      },
    } as unknown as BillingDeps["service"],
  }
}

const order = (overrides: Partial<OrderForBilling> = {}): OrderForBilling => ({
  id: "order_1",
  display_id: 1,
  created_at: "2026-10-20T15:00:00Z",
  total: 374360,
  shipping_total: 2900,
  items: [{ product_title: "Tarjeta de video", quantity: 1, unit_price: 371460, total: 371460 }],
  shipping_address: { first_name: "Ana", last_name: "Pérez" },
  ...overrides,
})

const day = (iso: string) => new Date(`${iso}Z`)
const NOW = day("2026-10-20T15:00:00")

const deps = (service: BillingDeps["service"], api: OpenFacturaApi, extra: Partial<BillingDeps> = {}): BillingDeps => ({
  service,
  api,
  emisor,
  now: NOW,
  ...extra,
})

describe("issueDocument", () => {
  it("emite la boleta, la registra con su folio y avisa que quedó lista", async () => {
    const { service, rows } = makeService()
    const issued: string[] = []
    const result = await issueDocument(deps(service, new MockOpenFacturaClient(), { onIssued: async (id) => void issued.push(id) }), order())

    expect(result.ok).toBe(true)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: "boleta", tipo_dte: 39, state: "issued", total: 374360, attempts: 1, sii_status: "Pendiente" })
    expect(rows[0].folio).toBe(result.folio)
    expect(rows[0].token).toEqual(expect.any(String))
    expect(issued).toEqual([rows[0].id])
  })

  it("no emite dos veces el documento de un pedido", async () => {
    const { service, rows } = makeService()
    const api = new MockOpenFacturaClient()
    const emit = jest.spyOn(api, "emit")
    await issueDocument(deps(service, api), order({ id: "order_dup" }))
    const again = await issueDocument(deps(service, api), order({ id: "order_dup" }))

    expect(again).toMatchObject({ ok: true, alreadyIssued: true })
    expect(emit).toHaveBeenCalledTimes(1)
    expect(rows).toHaveLength(1)
  })

  it("emite factura cuando el cliente la pidió con datos válidos", async () => {
    const { service, rows } = makeService()
    await issueDocument(
      deps(service, new MockOpenFacturaClient()),
      order({
        id: "order_f",
        metadata: {
          document: {
            type: "factura",
            rut: "76.430.498-5",
            razonSocial: "Hosty SpA",
            giro: "Servicios informáticos",
            direccion: "Arturo Prat 527",
            comuna: "Curicó",
          },
        },
      }),
    )
    expect(rows[0]).toMatchObject({ kind: "factura", tipo_dte: 33, state: "issued" })
    expect(rows[0].receptor).toMatchObject({ rut: "76430498-5", razonSocial: "Hosty SpA" })
  })

  it("sin datos del emisor deja el pedido registrado como fallido y no reintentable", async () => {
    const { service, rows } = makeService()
    const failed: string[] = []
    const result = await issueDocument(
      deps(service, new MockOpenFacturaClient(), { emisor: null, onFailed: async (_id, error) => void failed.push(error) }),
      order(),
    )
    expect(result.ok).toBe(false)
    expect(rows[0]).toMatchObject({ state: "failed", retryable: false })
    expect(failed[0]).toMatch(/BILLING_EMISOR/)
  })

  it("un pedido cuyas líneas no calzan con lo cobrado no se emite y no se reintenta", async () => {
    const { service, rows } = makeService()
    const api = new MockOpenFacturaClient()
    const emit = jest.spyOn(api, "emit")
    const result = await issueDocument(deps(service, api), order({ total: 999999 }))
    expect(result.ok).toBe(false)
    expect(rows[0]).toMatchObject({ state: "failed", retryable: false })
    expect(emit).not.toHaveBeenCalled()
  })

  it("una falla de red se marca reintentable y el reintento usa la misma clave de idempotencia", async () => {
    const { service, rows } = makeService()
    const keys: string[] = []
    let calls = 0
    const flaky: OpenFacturaApi = {
      isMock: true,
      emit: async (_request, key) => {
        keys.push(key)
        if (++calls === 1) {
          throw new Error("fetch failed")
        }
        return { token: "TOK", folio: 55, resolucion: null }
      },
      getStatus: async () => "Pendiente",
      getPdf: async () => Buffer.from(""),
    }

    const first = await issueDocument(deps(service, flaky), order())
    expect(first.ok).toBe(false)
    expect(rows[0]).toMatchObject({ state: "failed", retryable: true, last_error: "fetch failed" })

    const second = await issueDocument(deps(service, flaky), order())
    expect(second).toMatchObject({ ok: true, folio: 55 })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ state: "issued", attempts: 2 })
    expect(keys).toEqual(["order_1-boleta", "order_1-boleta"])
  })

  it("un rechazo por validación se marca como no reintentable", async () => {
    const { service, rows } = makeService()
    const api: OpenFacturaApi = {
      isMock: false,
      emit: async () => {
        throw new OpenFacturaError("Validación de Campos - MntNeto: Monto erróneo", 400, { code: "OF-10" })
      },
      getStatus: async () => "Pendiente",
      getPdf: async () => Buffer.from(""),
    }
    const failed: boolean[] = []
    await issueDocument(deps(service, api, { onFailed: async (_id, _error, retryable) => void failed.push(retryable) }), order())
    expect(rows[0]).toMatchObject({ state: "failed", retryable: false })
    expect(failed).toEqual([false])
  })

  it("pasado el plazo seguro sin token no reintenta solo, para no duplicar el documento", async () => {
    const { service, rows } = makeService()
    const api = new MockOpenFacturaClient()
    const emit = jest.spyOn(api, "emit")
    await service.createBillingDocuments({
      medusa_order_id: "order_old",
      kind: "boleta",
      tipo_dte: 39,
      state: "failed",
      total: 374360,
      attempts: 3,
      first_attempt_at: new Date(NOW.getTime() - SAFE_RETRY_WINDOW_MS - 60_000),
    })
    const result = await issueDocument(deps(service, api), order({ id: "order_old" }))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/plazo seguro/)
    expect(emit).not.toHaveBeenCalled()
    expect(rows[0].retryable).toBe(false)

    // Un administrador puede forzarlo tras revisar en OpenFactura.
    expect((await issueDocument(deps(service, api), order({ id: "order_old" }), { force: true })).ok).toBe(true)
  })

  it("un fallo al avisar no deshace el documento emitido", async () => {
    const { service, rows } = makeService()
    const result = await issueDocument(
      deps(service, new MockOpenFacturaClient(), {
        onIssued: async () => {
          throw new Error("SMTP caído")
        },
      }),
      order({ id: "order_notify" }),
    )
    expect(result.ok).toBe(true)
    expect(rows[0].state).toBe("issued")
  })
})

describe("issueCreditNote", () => {
  const issueOne = async () => {
    const made = makeService()
    const api = new MockOpenFacturaClient()
    await issueDocument(deps(made.service, api), order({ id: "order_nc" }))
    return { ...made, api, documentId: made.rows[0].id as string }
  }

  it("anula un documento emitido con una nota de crédito que lo referencia", async () => {
    const { service, rows, api, documentId } = await issueOne()
    const emit = jest.spyOn(api, "emit")
    const result = await issueCreditNote(deps(service, api), documentId, "Anula boleta por devolución")

    expect(result.ok).toBe(true)
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ kind: "nota_credito", tipo_dte: 61, state: "issued", voids_document_id: documentId })
    const dte = (emit.mock.calls[0][0].dte as { Referencia: Record<string, unknown>[] }).Referencia[0]
    expect(dte).toMatchObject({ TpoDocRef: "39", FolioRef: String(rows[0].folio), CodRef: 1 })
  })

  it("no emite dos notas de crédito para el mismo documento", async () => {
    const { service, rows, api, documentId } = await issueOne()
    await issueCreditNote(deps(service, api), documentId, "Anula")
    const again = await issueCreditNote(deps(service, api), documentId, "Anula")
    expect(again.alreadyIssued).toBe(true)
    expect(rows.filter((row) => row.kind === "nota_credito")).toHaveLength(1)
  })

  it("solo anula documentos ya emitidos", async () => {
    const { service } = makeService()
    const doc = await service.createBillingDocuments({ medusa_order_id: "o", kind: "boleta", tipo_dte: 39, state: "failed", total: 1 })
    const result = await issueCreditNote(deps(service, new MockOpenFacturaClient()), doc.id, "x")
    expect(result.ok).toBe(false)
  })
})

describe("pollSiiStatus", () => {
  it("actualiza el estado y avisa los rechazos del SII", async () => {
    const { service, rows } = makeService()
    const api = new MockOpenFacturaClient()
    await issueDocument(deps(service, api), order({ id: "order_ok" }))
    await issueDocument(deps(service, api), order({ id: "order_bad" }))
    rows[1].token = "TOKEN-DESCONOCIDO"

    const rejected: string[] = []
    const result = await pollSiiStatus(deps(service, api), { onRejected: async (id) => void rejected.push(id) })

    expect(result).toEqual({ checked: 2, rejected: 1 })
    expect(rows[0].sii_status).toBe("Aceptado")
    expect(rows[1].sii_status).toBe("Rechazado")
    expect(rejected).toEqual([rows[1].id])
  })

  it("no vuelve a consultar los documentos ya resueltos ni los muy antiguos", async () => {
    const { service, rows } = makeService()
    const api = new MockOpenFacturaClient()
    await issueDocument(deps(service, api), order({ id: "order_a" }))
    await issueDocument(deps(service, api), order({ id: "order_b" }))
    rows[0].sii_status = "Aceptado"
    rows[1].issued_at = new Date(NOW.getTime() - 80 * 3_600_000)
    expect(await pollSiiStatus(deps(service, api))).toEqual({ checked: 0, rejected: 0 })
  })
})

describe("retryFailed", () => {
  const failedService = async (overrides: Record<string, unknown>) => {
    const made = makeService()
    await made.service.createBillingDocuments({
      medusa_order_id: "order_r",
      kind: "boleta",
      tipo_dte: 39,
      state: "failed",
      total: 374360,
      attempts: 1,
      retryable: true,
      first_attempt_at: new Date(NOW.getTime() - 3_600_000),
      last_attempt_at: new Date(NOW.getTime() - 10 * 60_000),
      ...overrides,
    })
    return made
  }

  it("reintenta lo que falló por un problema pasajero y lo deja emitido", async () => {
    const { service, rows } = await failedService({})
    const result = await retryFailed(deps(service, new MockOpenFacturaClient()), async () => order({ id: "order_r" }))
    expect(result.retried).toBe(1)
    expect(rows[0].state).toBe("issued")
  })

  it("respeta la espera entre reintentos", async () => {
    const { service } = await failedService({ attempts: 3, last_attempt_at: new Date(NOW.getTime() - 60_000) })
    const result = await retryFailed(deps(service, new MockOpenFacturaClient()), async () => order({ id: "order_r" }))
    expect(result.retried).toBe(0)
  })

  it("no reintenta datos inválidos ni supera el máximo de intentos", async () => {
    const invalid = await failedService({ retryable: false })
    expect((await retryFailed(deps(invalid.service, new MockOpenFacturaClient()), async () => order({ id: "order_r" }))).retried).toBe(0)
    const exhausted = await failedService({ attempts: MAX_ATTEMPTS })
    expect((await retryFailed(deps(exhausted.service, new MockOpenFacturaClient()), async () => order({ id: "order_r" }))).retried).toBe(0)
  })
})
