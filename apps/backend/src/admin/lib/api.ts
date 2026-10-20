import { useCallback, useEffect, useRef, useState } from "react"

declare const __BACKEND_URL__: string | undefined

// Puede venir como "/" o con barra final; se normaliza para no generar "//admin/...".
const BASE = (typeof __BACKEND_URL__ === "string" ? __BACKEND_URL__ : "").replace(/\/+$/, "")

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// El admin de Medusa autentica con la cookie de sesión, por eso credentials: "include".
export const api = async <T>(
  path: string,
  options: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {},
): Promise<T> => {
  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  if (!response.ok) {
    let message = `Error ${response.status}`
    try {
      const payload = await response.json()
      message = payload.message ?? message
    } catch {
      // La respuesta de error no siempre trae JSON.
    }
    throw new ApiError(message, response.status)
  }
  return (await response.json()) as T
}

type State<T> = { data: T | null; error: string | null; loading: boolean }

// Carga un endpoint y permite recargarlo. refreshMs > 0 lo refresca solo.
export const useApi = <T>(path: string | null, refreshMs = 0) => {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: path !== null })
  const current = useRef(path)
  current.current = path

  const load = useCallback(async () => {
    if (current.current === null) {
      return
    }
    const requested = current.current
    try {
      const data = await api<T>(requested)
      if (current.current === requested) {
        setState({ data, error: null, loading: false })
      }
    } catch (error) {
      if (current.current === requested) {
        setState((prev) => ({ data: prev.data, error: (error as Error).message, loading: false }))
      }
    }
  }, [])

  useEffect(() => {
    setState((prev) => ({ ...prev, loading: path !== null }))
    load()
    if (!refreshMs) {
      return
    }
    const timer = setInterval(load, refreshMs)
    return () => clearInterval(timer)
  }, [path, refreshMs, load])

  return { ...state, reload: load }
}
