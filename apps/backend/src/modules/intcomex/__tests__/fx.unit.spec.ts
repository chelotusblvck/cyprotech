import { resolveUsdClp } from "../sync/fx"

const makeStore = (rows: { date: string; rate: number; source: string }[] = []) => {
  const data = [...rows]
  return {
    data,
    listIntcomexFxRates: jest.fn(
      async (filters: Record<string, unknown> = {}, config: Record<string, unknown> = {}) => {
        let out = data.filter((row) => !filters.date || row.date === filters.date)
        if (config.order) {
          out = [...out].sort((a, b) => (a.date < b.date ? 1 : -1))
        }
        return config.take ? out.slice(0, Number(config.take)) : out
      },
    ),
    createIntcomexFxRates: jest.fn(async (row: { date: string; rate: number; source: string }) => {
      data.push(row)
    }),
  }
}

const now = new Date("2026-10-20T12:00:00Z")
const quote = { rate: 950, date: "2026-10-20", source: "mindicador.cl" }

describe("resolveUsdClp", () => {
  it("usa el override manual sin tocar la red ni la base", async () => {
    const store = makeStore()
    const fetchQuote = jest.fn()
    const result = await resolveUsdClp(store, {
      env: { FX_USD_CLP_OVERRIDE: "1000" } as unknown as NodeJS.ProcessEnv,
      now,
      fetchQuote,
    })
    expect(result).toMatchObject({ rate: 1000, source: "override", stale: false })
    expect(fetchQuote).not.toHaveBeenCalled()
  })

  it("reutiliza el valor guardado hoy", async () => {
    const store = makeStore([{ date: "2026-10-20", rate: 940, source: "mindicador.cl" }])
    const fetchQuote = jest.fn()
    const result = await resolveUsdClp(store, { env: {} as NodeJS.ProcessEnv, now, fetchQuote })
    expect(result.rate).toBe(940)
    expect(fetchQuote).not.toHaveBeenCalled()
  })

  it("trae y guarda el valor del día cuando no existe", async () => {
    const store = makeStore()
    const result = await resolveUsdClp(store, {
      env: {} as NodeJS.ProcessEnv,
      now,
      fetchQuote: async () => quote,
    })
    expect(result).toMatchObject({ rate: 950, stale: false })
    expect(store.createIntcomexFxRates).toHaveBeenCalledWith({
      date: "2026-10-20",
      rate: 950,
      source: "mindicador.cl",
    })
  })

  it("cae al último valor guardado si la red falla y lo marca como desactualizado", async () => {
    const store = makeStore([{ date: "2026-10-18", rate: 930, source: "mindicador.cl" }])
    const result = await resolveUsdClp(store, {
      env: {} as NodeJS.ProcessEnv,
      now,
      fetchQuote: async () => {
        throw new Error("sin red")
      },
    })
    expect(result).toMatchObject({ rate: 930, date: "2026-10-18", stale: true })
  })

  it("falla si no hay red ni valor guardado", async () => {
    await expect(
      resolveUsdClp(makeStore(), {
        env: {} as NodeJS.ProcessEnv,
        now,
        fetchQuote: async () => {
          throw new Error("sin red")
        },
      }),
    ).rejects.toThrow(/no hay uno guardado/)
  })
})
