import type { IntcomexConfig } from "./config"
import { buildAuthorizationHeader } from "./signature"
import type {
  IntcomexApi,
  IwsInventoryItem,
  IwsOrderStatus,
  IwsPriceData,
  IwsProduct,
  IwsRequestOrder,
  IwsSalesOrder,
  IwsShippingRate,
} from "./types"

export class IntcomexError extends Error {
  status: number
  errorCode?: number
  reference?: string
  sku?: string

  constructor(message: string, status: number, details: Partial<IntcomexError> = {}) {
    super(message)
    this.name = "IntcomexError"
    this.status = status
    this.errorCode = details.errorCode
    this.reference = details.reference
    this.sku = details.sku
  }
}

type FetchLike = typeof fetch

type RequestOptions = {
  method?: "GET" | "POST"
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Errores que vale la pena reintentar: límite de frecuencia y fallas del servidor.
const isRetryable = (status: number) => status === 429 || status >= 500

export class IntcomexClient implements IntcomexApi {
  readonly isMock = false

  constructor(
    private readonly config: IntcomexConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private url(path: string, query: RequestOptions["query"] = {}) {
    const url = new URL(path.replace(/^\//, ""), this.config.baseUrl)
    for (const [key, value] of Object.entries({ locale: this.config.locale, ...query })) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }
    return url.toString()
  }

  // La firma depende de la hora, así que se calcula en cada intento.
  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", query, body } = options
    let lastError: unknown

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs)
      try {
        const response = await this.fetchImpl(this.url(path, query), {
          method,
          headers: {
            Authorization: buildAuthorizationHeader(this.config.apiKey, this.config.accessKey),
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        })

        if (response.ok) {
          return (await response.json()) as T
        }

        const error = await this.toError(response)
        if (!isRetryable(response.status) || attempt === this.config.maxRetries) {
          throw error
        }
        lastError = error
      } catch (error) {
        if (error instanceof IntcomexError && !isRetryable(error.status)) {
          throw error
        }
        lastError = error
        if (attempt === this.config.maxRetries) {
          throw error
        }
      } finally {
        clearTimeout(timer)
      }

      await sleep(Math.min(2 ** attempt * 1000, 15_000))
    }

    throw lastError
  }

  private async toError(response: Response) {
    let payload: { Message?: string; ErrorCode?: number; Reference?: string; Sku?: string } = {}
    try {
      payload = await response.json()
    } catch {
      // La respuesta de error no siempre es JSON.
    }
    return new IntcomexError(
      payload.Message ?? `IWS respondió ${response.status}`,
      response.status,
      { errorCode: payload.ErrorCode, reference: payload.Reference, sku: payload.Sku },
    )
  }

  getCatalog() {
    return this.request<IwsProduct[]>("getcatalog")
  }

  getPriceList() {
    return this.request<IwsPriceData[]>("getpricelist")
  }

  getInventory() {
    return this.request<IwsInventoryItem[]>("getinventory")
  }

  // Uso puntual, justo antes de cobrar. IWS no autoriza llamarlo masivamente.
  async getProduct(sku: string) {
    try {
      return await this.request<IwsProduct>("getproduct", {
        query: { sku, includePriceData: true, includeInventoryData: true },
      })
    } catch (error) {
      if (error instanceof IntcomexError && error.status === 404) {
        return null
      }
      throw error
    }
  }

  placeOrder(order: IwsRequestOrder) {
    return this.request<IwsSalesOrder>("placeorder", {
      method: "POST",
      query: { customerOrderNumber: order.CustomerOrderNumber },
      body: order,
    })
  }

  getOrderStatus(orderNumber: string) {
    return this.request<IwsOrderStatus>("getorderstatus", { query: { orderNumber } })
  }

  getOrder(orderNumber: string) {
    return this.request<IwsSalesOrder>("getorder", { query: { orderNumber } })
  }

  cancelOrder(orderNumber: string) {
    return this.request<IwsSalesOrder>("cancelorder", {
      method: "POST",
      body: { OrderNumber: orderNumber },
    })
  }

  calculateShippingRates(order: IwsRequestOrder) {
    return this.request<IwsShippingRate[]>("calculateShippingRates", {
      method: "POST",
      body: order,
    })
  }
}
