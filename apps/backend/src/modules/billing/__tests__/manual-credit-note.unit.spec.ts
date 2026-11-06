import { OpenFacturaError } from "../client/client"
import type { EmissionResult, OpenFacturaApi } from "../client/types"
import { confirmManualCreditNote, issueCreditNote, issueDocument, pollSiiStatus, type BillingDeps } from "../operations"
import type { OrderForBilling } from "../types"

// Servicio en memoria con la misma forma que el generado por MedusaService.
const makeService = () => {
  let seq = 0
  const rows: Record<string, any>[] = []
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

const order: OrderForBilling = {
  id: "order_1",
  display_id: 1,
  created_at: "2026-10-20T15:00:00Z",
  total: 374360,
  shipping_total: 2900,
  items: [{ product_title: "Tarjeta de video", quantity: 1, unit_price: 371460, total: 371460 }],
  shipping_address: { first_name: "Ana", last_name: "Pérez" },
}

// Proveedor como el servicio de boletas: emite boletas por API pero las notas de crédito son manuales.
const manualApi = () => {
  const calls: { requested: [number, string][]; confirmed: [number, number, string | undefined][]; emitted: number } = {
    requested: [],
    confirmed: [],
    emitted: 0,
  }
  let failNextRequest: Error | null = null
  let failNextConfirm: Error | null = null
  const api: OpenFacturaApi = {
    isMock: false,
    issuerManagedRemotely: true,
    cancellation: "manual",
    emit: async (): Promise<EmissionResult> => {
      calls.emitted++
      return { token: "12-6b639b709e3806da", folio: 12 }
    },
    getStatus: async () => "Pendiente",
    getPdf: async () => Buffer.from("%PDF"),
    requestCancellation: async (folio, reason) => {
      if (failNextRequest) {
        const error = failNextRequest
        failNextRequest = null
        throw error
      }
      calls.requested.push([folio, reason])
      return { instructions: "Emitir la nota en el portal del SII" }
    },
    confirmCancellation: async (folio, creditNoteFolio, date) => {
      if (failNextConfirm) {
        const error = failNextConfirm
        failNextConfirm = null
        throw error
      }
      calls.confirmed.push([folio, creditNoteFolio, date])
    },
  }
  return {
    api,
    calls,
    failRequestOnce: (error: Error) => (failNextRequest = error),
    failConfirmOnce: (error: Error) => (failNextConfirm = error),
  }
}

const NOW = new Date("2026-10-20T15:00:00Z")

const setup = async () => {
  const { service, rows } = makeService()
  const provider = manualApi()
  const alerts: [string, string][] = []
  // Sin datos de emisor: con este proveedor viven en el servicio y no deben bloquear nada.
  const deps: BillingDeps = {
    service,
    api: provider.api,
    emisor: null,
    now: NOW,
    onManualCreditNote: async (id, instructions) => {
      alerts.push([id, instructions])
    },
  }
  // runtime.ts pone un emisor de relleno para este proveedor; aquí se simula igual.
  deps.emisor = { rut: "0-0", razonSocial: "x", giro: "x", acteco: 1, direccion: "x", comuna: "x" }
  const issued = await issueDocument(deps, order)
  return { deps, rows, provider, alerts, documentId: issued.documentId as string }
}

describe("anulación con un proveedor que no emite notas de crédito por API", () => {
  it("registra la solicitud en el servicio, deja la nota pendiente y avisa, sin emitir ninguna nota por API", async () => {
    const { deps, rows, provider, alerts, documentId } = await setup()
    const emittedBefore = provider.calls.emitted

    const result = await issueCreditNote(deps, documentId, "Devolución del cliente")

    expect(result).toMatchObject({ ok: true, manual: true, folio: null, instructions: "Emitir la nota en el portal del SII" })
    expect(provider.calls.requested).toEqual([[12, "Devolución del cliente"]])
    expect(provider.calls.emitted).toBe(emittedBefore)

    const credit = rows.find((row) => row.kind === "nota_credito")!
    expect(credit).toMatchObject({ state: "manual_pending", tipo_dte: 61, voids_document_id: documentId, retryable: false, last_error: null })
    expect(alerts).toEqual([[credit.id, "Emitir la nota en el portal del SII"]])
  })

  it("pedirla otra vez no duplica la solicitud ni el aviso", async () => {
    const { deps, rows, provider, alerts, documentId } = await setup()
    await issueCreditNote(deps, documentId, "Devolución")
    const second = await issueCreditNote(deps, documentId, "Devolución")

    expect(second).toMatchObject({ ok: true, manual: true })
    expect(provider.calls.requested).toHaveLength(1)
    expect(alerts).toHaveLength(1)
    expect(rows.filter((row) => row.kind === "nota_credito")).toHaveLength(1)
  })

  it("si el servicio no responde, la nota queda fallida y se puede pedir de nuevo sin duplicar filas", async () => {
    const { deps, rows, provider, alerts, documentId } = await setup()
    provider.failRequestOnce(new OpenFacturaError("No se pudo conectar con el servicio de boletas", 503))

    const failed = await issueCreditNote(deps, documentId, "Devolución")
    expect(failed.ok).toBe(false)
    expect(rows.find((row) => row.kind === "nota_credito")).toMatchObject({ state: "failed", retryable: true })
    expect(alerts).toHaveLength(0)

    const retried = await issueCreditNote(deps, documentId, "Devolución")
    expect(retried).toMatchObject({ ok: true, manual: true })
    expect(rows.filter((row) => row.kind === "nota_credito")).toHaveLength(1)
    expect(rows.find((row) => row.kind === "nota_credito")).toMatchObject({ state: "manual_pending", attempts: 2 })
  })

  it("solo se puede anular un documento ya emitido", async () => {
    const { deps, rows, documentId } = await setup()
    rows.find((row) => row.id === documentId)!.state = "failed"
    const result = await issueCreditNote(deps, documentId, "Devolución")
    expect(result).toMatchObject({ ok: false, error: "Solo se puede anular un documento ya emitido." })
  })
})

describe("confirmManualCreditNote", () => {
  it("registra el folio de la nota emitida en el portal: el documento queda anulado y aceptado", async () => {
    const { deps, rows, provider, documentId } = await setup()
    await issueCreditNote(deps, documentId, "Devolución")

    const result = await confirmManualCreditNote(deps, documentId, 7701, "2026-10-21")

    expect(result).toMatchObject({ ok: true, folio: 7701 })
    expect(provider.calls.confirmed).toEqual([[12, 7701, "2026-10-21"]])
    expect(rows.find((row) => row.kind === "nota_credito")).toMatchObject({
      state: "issued",
      folio: 7701,
      sii_status: "Aceptado",
      emission_date: "2026-10-21",
      last_error: null,
    })
  })

  it("sin fecha usa la de hoy en Chile", async () => {
    const { deps, rows, documentId } = await setup()
    await issueCreditNote(deps, documentId, "Devolución")
    await confirmManualCreditNote(deps, documentId, 7701)
    expect(rows.find((row) => row.kind === "nota_credito")!.emission_date).toBe("2026-10-20")
  })

  it("confirmar lo mismo dos veces es idempotente, y con otra nota es un error", async () => {
    const { deps, provider, documentId } = await setup()
    await issueCreditNote(deps, documentId, "Devolución")
    await confirmManualCreditNote(deps, documentId, 7701)

    expect(await confirmManualCreditNote(deps, documentId, 7701)).toMatchObject({ ok: true, alreadyIssued: true, folio: 7701 })
    const other = await confirmManualCreditNote(deps, documentId, 9999)
    expect(other.ok).toBe(false)
    expect(other.error).toMatch(/ya fue anulado con la nota de crédito 7701/)
    expect(provider.calls.confirmed).toHaveLength(1)
  })

  it("no confirma lo que nadie pidió anular", async () => {
    const { deps, provider, documentId } = await setup()
    const result = await confirmManualCreditNote(deps, documentId, 7701)
    expect(result).toMatchObject({ ok: false, error: "Ese documento no tiene una anulación solicitada." })
    expect(provider.calls.confirmed).toHaveLength(0)
  })

  it("si el servicio rechaza la confirmación, la nota sigue pendiente", async () => {
    const { deps, rows, provider, documentId } = await setup()
    await issueCreditNote(deps, documentId, "Devolución")
    provider.failConfirmOnce(new OpenFacturaError("Esa boleta ya fue anulada con la Nota de Credito 5", 409))

    const result = await confirmManualCreditNote(deps, documentId, 7701)
    expect(result).toMatchObject({ ok: false, error: "Esa boleta ya fue anulada con la Nota de Credito 5" })
    expect(rows.find((row) => row.kind === "nota_credito")!.state).toBe("manual_pending")
  })

  it("un proveedor que emite notas por API no tiene nada que confirmar", async () => {
    const { deps, documentId } = await setup()
    const api = { ...deps.api, confirmCancellation: undefined } as OpenFacturaApi
    const result = await confirmManualCreditNote({ ...deps, api }, documentId, 7701)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/emite las notas de crédito por API/)
  })
})

describe("consulta de estado con notas manuales", () => {
  it("una nota pendiente o confirmada (sin token) no se consulta al SII", async () => {
    const { deps, documentId } = await setup()
    await issueCreditNote(deps, documentId, "Devolución")
    await confirmManualCreditNote(deps, documentId, 7701)
    let queried = 0
    deps.api.getStatus = async () => {
      queried++
      return "Pendiente"
    }
    const result = await pollSiiStatus(deps)
    // Solo la boleta original (con token) se consulta; la nota de crédito, emitida por el propio SII, no.
    expect(queried).toBe(1)
    expect(result.rejected).toBe(0)
  })
})
