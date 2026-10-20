// Tipos de la API IWS de Intcomex (v1.57.6). Fuente: docs/intcomex/iws-openapi-en.json

export type IwsPriceData = {
  Sku?: string
  Mpn?: string
  // Precio neto (sin impuestos) para nuestra cuenta.
  UnitPrice: number
  CurrencyId: string
  PriceTaxAmount?: number
  PricePlusTax?: number
  OriginalPrice?: number
  OriginalPriceTaxAmount?: number
  OriginalPricePlusTax?: number
  BasePrice?: number
  BasePriceTaxAmount?: number
  BasePricePlusTax?: number
  RebateAmount?: number
  TaxRate?: number
}

export type IwsCategory = {
  CategoryId: string
  Description: string
  Subcategories?: IwsCategory[]
}

export type IwsLocation = { Id: string; Stock: number }

export type IwsFreight = {
  Item?: Record<string, unknown>
  Package?: Record<string, unknown>
}

export type IwsProduct = {
  Sku: string
  Mpn?: string
  Manufacturer?: { ManufacturerId?: string; Description?: string }
  Brand?: { ManufacturerId?: string; BrandId?: string; Description?: string }
  Category?: IwsCategory
  Description: string
  // Physical | License | Warranty | Downloadable
  Type?: string
  ProductLine?: string
  Model?: string
  New?: boolean
  Price?: IwsPriceData
  InStock?: number
  Locations?: IwsLocation[]
  OnSale?: boolean
  Upc?: string
  Freight?: IwsFreight
}

export type IwsInventoryItem = {
  Sku: string
  Mpn?: string
  InStock: number
  Locations?: IwsLocation[]
}

export type IwsStoreOrderAddress = {
  FirstName?: string
  LastName?: string
  Email?: string
  DocumentId?: string
  Cellphone?: string
  LandLinePhone?: string
  OtherPhone?: string
  Address?: string
  SuiteNumber?: string
  ComplexName?: string
  LastLocalizationReference?: string
  State?: string
  StateId?: string
  City?: string
  Neighborhood?: string
  PostalCode?: string
  CountryId?: string
}

export type IwsRequestOrder = {
  Location?: string
  Tag?: string
  CustomerOrderNumber?: string
  TaxRegistrationNumber?: string
  InvoiceRequested?: boolean
  ReceiveInvoiceByMail?: boolean
  StoreOrder?: {
    StoreOrderNumber?: string
    Customer?: { FirstName?: string; LastName?: string; Email?: string; DocumentId?: string }
    Billing?: IwsStoreOrderAddress
    Shipping?: IwsStoreOrderAddress
    DeliveryType?: string
    OrderTotal?: number
    BusinessType?: string
  }
  Shipments?: {
    ServiceType: string
    Amount: number
    CarrierId?: string
    PackingType?: string
    FreightCost?: number
  }[]
  Items: { Sku: string; Quantity: number; StoreItemId?: string }[]
}

export type IwsSalesOrder = {
  OrderNumber: string
  OrderDate?: string
  CustomerOrderNumber?: string
  CurrencyId?: string
  Subtotal?: { UsAmount?: number; HomeAmount?: number | null }
  Tax?: { UsAmount?: number; HomeAmount?: number | null }
  ShippingFee?: { UsAmount?: number; HomeAmount?: number | null }
  Total?: { UsAmount?: number; HomeAmount?: number | null }
  Items?: {
    LineNumber: number
    Quantity: number
    Product?: { Sku?: string; Description?: string }
  }[]
  Shipments?: {
    ShipmentId?: number
    FreightService?: string
    FreightShipmentId?: string
    ServiceType?: string
    CarrierId?: string
    Amount?: number
  }[]
}

export type IwsOrderStatus = { StatusCode: number; Description: string }

export type IwsShippingRate = {
  Id?: number
  Amount: number
  CurrencyId?: string
  ServiceType?: string
  DurationTerms?: string
  Days?: number
  Trackable?: boolean
  Provider?: string
  ServiceId?: string
}

// Estados de una orden en Intcomex.
export const IWS_ORDER_STATUS = {
  OPEN: 1,
  IN_PROCESS: 2,
  BACK_ORDER: 3,
  READY_TO_DELIVER: 4,
  INVOICED_CLOSED: 5,
  CANCELED: 6,
  DELIVERED: 7,
} as const

// Superficie que usa el resto del sistema. La implementan el cliente real y el simulado.
export interface IntcomexApi {
  readonly isMock: boolean
  getCatalog(): Promise<IwsProduct[]>
  getPriceList(): Promise<IwsPriceData[]>
  getInventory(): Promise<IwsInventoryItem[]>
  getProduct(sku: string): Promise<IwsProduct | null>
  placeOrder(order: IwsRequestOrder): Promise<IwsSalesOrder>
  getOrderStatus(orderNumber: string): Promise<IwsOrderStatus>
  getOrder(orderNumber: string): Promise<IwsSalesOrder>
  cancelOrder(orderNumber: string): Promise<IwsSalesOrder>
  calculateShippingRates(order: IwsRequestOrder): Promise<IwsShippingRate[]>
}
