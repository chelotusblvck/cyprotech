import { MedusaError } from "@medusajs/framework/utils"
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
import { IWS_ORDER_STATUS } from "./types"

// Catálogo de ejemplo para desarrollo sin credenciales. Los SKU, IDs de categoría y costos
// son inventados: sirven para probar el flujo, no representan el portafolio real de Intcomex.
type Seed = [sku: string, mpn: string, brand: string, categoryId: string, category: string, description: string, costUsd: number, stock: number]

const SEEDS: Seed[] = [
  ["MK001GPU01", "RTX4070S-12G", "ASUS", "vga", "Tarjetas de Video", "Tarjeta de video ASUS Dual GeForce RTX 4070 SUPER 12GB GDDR6X", 578.9, 14],
  ["MK001GPU02", "RTX4060-8G", "MSI", "vga", "Tarjetas de Video", "Tarjeta de video MSI GeForce RTX 4060 Ventus 2X 8GB", 289.4, 22],
  ["MK001GPU03", "RX7800XT-16G", "Gigabyte", "vga", "Tarjetas de Video", "Tarjeta de video Gigabyte Radeon RX 7800 XT Gaming OC 16GB", 462.1, 6],
  ["MK001GPU04", "RTX4090-24G", "ASUS", "vga", "Tarjetas de Video", "Tarjeta de video ASUS ROG Strix GeForce RTX 4090 24GB", 1899, 1],
  ["MK002CPU01", "7800X3D", "AMD", "cpu", "Procesadores", "Procesador AMD Ryzen 7 7800X3D 4.2GHz AM5", 301.5, 18],
  ["MK002CPU02", "14700K", "Intel", "cpu", "Procesadores", "Procesador Intel Core i7-14700K 3.4GHz LGA1700", 355, 9],
  ["MK002CPU03", "7600", "AMD", "cpu", "Procesadores", "Procesador AMD Ryzen 5 7600 3.8GHz AM5", 178.2, 31],
  ["MK003MB01", "B650-PLUS", "ASUS", "mb", "Placas Madre", "Placa madre ASUS TUF Gaming B650-PLUS WiFi AM5", 189.9, 12],
  ["MK003MB02", "Z790-A", "MSI", "mb", "Placas Madre", "Placa madre MSI MAG Z790 Tomahawk WiFi LGA1700", 249, 7],
  ["MK004RAM01", "CL30-32", "Corsair", "ram", "Memoria RAM", "Memoria RAM Corsair Vengeance 32GB (2x16GB) DDR5 6000MHz", 109.5, 40],
  ["MK004RAM02", "FURY-16", "Kingston", "ram", "Memoria RAM", "Memoria RAM Kingston Fury Beast 16GB DDR4 3200MHz", 38.9, 55],
  ["MK005SSD01", "980PRO-1T", "Samsung", "ssd", "Almacenamiento", "SSD Samsung 980 PRO 1TB NVMe PCIe 4.0 M.2", 96.4, 28],
  ["MK005SSD02", "SN850X-2T", "WD", "ssd", "Almacenamiento", "SSD WD Black SN850X 2TB NVMe PCIe 4.0 M.2", 168, 16],
  ["MK005HDD01", "BARRA-2T", "Seagate", "hdd", "Almacenamiento", "Disco duro Seagate BarraCuda 2TB 7200RPM 3.5 pulgadas", 54.2, 33],
  ["MK006PSU01", "RM850E", "Corsair", "psu", "Fuentes de Poder", "Fuente de poder Corsair RM850e 850W 80 Plus Gold modular", 112.3, 20],
  ["MK006PSU02", "MWE-650", "Cooler Master", "psu", "Fuentes de Poder", "Fuente de poder Cooler Master MWE 650W 80 Plus Bronze", 58.9, 25],
  ["MK007CS01", "4000D", "Corsair", "case", "Gabinetes", "Gabinete Corsair 4000D Airflow Mid Tower vidrio templado negro", 79.9, 19],
  ["MK007CS02", "H510", "NZXT", "case", "Gabinetes", "Gabinete NZXT H510 Flow ATX blanco con ventanas", 84.5, 3],
  ["MK008COOL01", "AK400", "DeepCool", "cool", "Refrigeración", "Disipador de CPU DeepCool AK400 para AMD e Intel", 24.9, 44],
  ["MK008COOL02", "H150I", "Corsair", "cool", "Refrigeración", "Refrigeración líquida Corsair iCUE H150i Elite 360mm RGB", 189, 8],
  ["MK009MON01", "27GP850", "LG", "mon", "Monitores", "Monitor gamer LG UltraGear 27 pulgadas QHD 165Hz Nano IPS 1ms", 289, 15],
  ["MK009MON02", "G2724D", "Gigabyte", "mon", "Monitores", "Monitor gamer Gigabyte 27 pulgadas QHD 165Hz IPS", 215.5, 11],
  ["MK009MON03", "S24F350", "Samsung", "mon", "Monitores", "Monitor Samsung 24 pulgadas Full HD 75Hz IPS", 98.7, 36],
  ["MK010KB01", "K70-RGB", "Corsair", "kbd", "Teclados", "Teclado mecánico gamer Corsair K70 RGB Pro switch Cherry MX Red", 119.9, 17],
  ["MK010KB02", "BLACKWIDOW", "Razer", "kbd", "Teclados", "Teclado mecánico gamer Razer BlackWidow V4 RGB switch Green", 134.5, 10],
  ["MK010KB03", "K120", "Logitech", "kbd", "Teclados", "Teclado Logitech K120 USB estándar español", 8.9, 120],
  ["MK011MS01", "G502X", "Logitech", "mouse", "Mouse", "Mouse gamer Logitech G502 X Lightspeed inalámbrico 25K DPI", 99.9, 26],
  ["MK011MS02", "DEATHADDER", "Razer", "mouse", "Mouse", "Mouse gamer Razer DeathAdder V3 Pro inalámbrico 30K DPI", 118, 13],
  ["MK011MS03", "M170", "Logitech", "mouse", "Mouse", "Mouse inalámbrico Logitech M170 gris", 7.5, 150],
  ["MK012HP01", "ARCTIS7", "SteelSeries", "hs", "Audífonos", "Audífonos gamer SteelSeries Arctis Nova 7 inalámbricos con micrófono", 147, 12],
  ["MK012HP02", "KRAKEN", "Razer", "hs", "Audífonos", "Audífonos gamer Razer Kraken V3 X 7.1 USB con micrófono", 44.9, 29],
  ["MK013CH01", "TITAN-EVO", "Secretlab", "chair", "Sillas", "Silla gamer Secretlab Titan Evo talla L cuero sintético", 449, 4],
  ["MK014NB01", "X515", "ASUS", "nb", "Notebooks", "Notebook ASUS Vivobook 15 Intel Core i5-1235U 16GB 512GB SSD", 489, 14],
  ["MK014NB02", "PAV15", "HP", "nb", "Notebooks", "Notebook HP Pavilion 15 AMD Ryzen 7 16GB 512GB SSD", 579, 9],
  ["MK014NB03", "LOQ15", "Lenovo", "nb", "Notebooks", "Notebook gamer Lenovo LOQ 15 Ryzen 7 RTX 4060 16GB 512GB", 889, 7],
  ["MK015DT01", "AIO24", "HP", "dt", "Computadores de Escritorio", "Computador All in One HP 24 pulgadas Intel Core i5 8GB 512GB", 599, 5],
  ["MK016PR01", "L3250", "Epson", "prn", "Impresoras", "Impresora multifuncional Epson EcoTank L3250 WiFi", 159.9, 21],
  ["MK016PR02", "MFP135", "HP", "prn", "Impresoras", "Impresora multifuncional láser HP LaserJet MFP 135w", 139, 10],
  ["MK017AC01", "C920", "Logitech", "acc", "Accesorios", "Cámara web Logitech C920 HD Pro Full HD 1080p", 59.9, 38],
  ["MK017AC02", "HUB7", "Anker", "acc", "Accesorios", "Hub USB-C Anker 7 en 1 HDMI 4K Ethernet", 39.9, 27],
  ["MK020RT01", "AX3000", "TP-Link", "rt", "Routers", "Router WiFi 6 TP-Link Archer AX55 AX3000 doble banda", 64.9, 42],
  ["MK020RT02", "RT-AX86U", "ASUS", "rt", "Routers", "Router gamer ASUS RT-AX86U Pro WiFi 6 AX5700", 219, 8],
  ["MK021SW01", "TL-SG108", "TP-Link", "sw", "Switches", "Switch TP-Link TL-SG108 8 puertos Gigabit no administrable", 17.9, 60],
  ["MK021SW02", "SG350-28", "Cisco", "sw", "Switches", "Switch Cisco SG350-28 28 puertos Gigabit administrable", 389, 4],
  ["MK022AP01", "EAP670", "TP-Link", "ap", "Access Points", "Access point TP-Link Omada EAP670 WiFi 6 AX5400 PoE", 149, 12],
  ["MK022AP02", "U6-LITE", "Ubiquiti", "ap", "Access Points", "Access point Ubiquiti UniFi U6 Lite WiFi 6", 99, 19],
  ["MK023CB01", "CAT6-305", "Nexxt", "cab", "Cableado Estructurado", "Bobina de cable UTP Cat6 305 metros Nexxt gris", 112, 15],
  ["MK023CB02", "PP24", "Nexxt", "cab", "Cableado Estructurado", "Patch panel Nexxt 24 puertos Cat6 rackeable", 36.5, 22],
  ["MK030CAM01", "DS-2CD", "Hikvision", "cam", "Cámaras IP", "Cámara IP Hikvision 4MP exterior bala IP67 visión nocturna 30m", 42.9, 35],
  ["MK030CAM02", "C8C", "Dahua", "cam", "Cámaras IP", "Cámara IP Dahua 4MP domo PoE audio integrado", 51.5, 24],
  ["MK030CAM03", "TAPO-C320", "TP-Link", "cam", "Cámaras IP", "Cámara WiFi TP-Link Tapo C320WS 4MP exterior color nocturno", 49.9, 30],
  ["MK031NVR01", "DS-7608", "Hikvision", "nvr", "Grabadores NVR/DVR", "Grabador NVR Hikvision 8 canales PoE 4K H.265+", 118, 9],
  ["MK031NVR02", "XVR1B08", "Dahua", "nvr", "Grabadores NVR/DVR", "Grabador DVR Dahua 8 canales 1080p Penta-brid", 62.5, 14],
  ["MK032AC01", "DS-K1T", "Hikvision", "acs", "Control de Acceso", "Control de acceso facial Hikvision terminal biométrico", 289, 5],
  ["MK033AL01", "AX-PRO", "Hikvision", "alm", "Alarmas", "Kit de alarma inalámbrica Hikvision AX PRO con sensores y sirena", 199, 7],
  // Casos de prueba del filtro: digital, sin stock y sin categoría conocida.
  ["SE001MSO01", "AAA-01148", "Microsoft", "sfw", "Software", "Microsoft Office Hogar y Estudiantes 2021 licencia digital", 119, 0],
  ["MK099ZZ01", "MISC-1", "Genérico", "misc", "Varios", "Pack de etiquetas adhesivas variadas", 3.2, 80],
  ["MK099ZZ02", "OOS-1", "Genérico", "acc", "Accesorios", "Soporte de pared para monitor sin stock", 12.5, 0],
]

const toProduct = ([sku, mpn, brand, categoryId, category, description, cost, stock]: Seed): IwsProduct => ({
  Sku: sku,
  Mpn: mpn,
  Manufacturer: { ManufacturerId: brand.toLowerCase(), Description: brand },
  Brand: { ManufacturerId: brand.toLowerCase(), BrandId: brand.toLowerCase(), Description: brand },
  Category: { CategoryId: categoryId, Description: category, Subcategories: [] },
  Description: description,
  Type: sku.startsWith("SE") ? "Downloadable" : "Physical",
  Price: { Sku: sku, Mpn: mpn, UnitPrice: cost, CurrencyId: "US", TaxRate: 0.19 },
  InStock: stock,
  Locations: [{ Id: "SCL", Stock: stock }],
  OnSale: false,
  Upc: `00${sku}`,
})

export class MockIntcomexClient implements IntcomexApi {
  readonly isMock = true
  private orderSeq = 100000
  private orders = new Map<string, IwsSalesOrder>()

  async getCatalog() {
    return SEEDS.map(toProduct)
  }

  async getPriceList(): Promise<IwsPriceData[]> {
    return SEEDS.map(toProduct).map((product) => product.Price!)
  }

  async getInventory(): Promise<IwsInventoryItem[]> {
    return SEEDS.map(toProduct).map((product) => ({
      Sku: product.Sku,
      Mpn: product.Mpn,
      InStock: product.InStock ?? 0,
      Locations: product.Locations,
    }))
  }

  async getProduct(sku: string) {
    const seed = SEEDS.find((entry) => entry[0] === sku)
    return seed ? toProduct(seed) : null
  }

  async placeOrder(order: IwsRequestOrder): Promise<IwsSalesOrder> {
    const orderNumber = `MOCK-${++this.orderSeq}`
    const sales: IwsSalesOrder = {
      OrderNumber: orderNumber,
      OrderDate: new Date().toISOString(),
      CustomerOrderNumber: order.CustomerOrderNumber,
      Items: order.Items.map((item, index) => ({
        LineNumber: index + 1,
        Quantity: item.Quantity,
        Product: { Sku: item.Sku },
      })),
    }
    this.orders.set(orderNumber, sales)
    return sales
  }

  async getOrderStatus(orderNumber: string): Promise<IwsOrderStatus> {
    return this.orders.has(orderNumber)
      ? { StatusCode: IWS_ORDER_STATUS.OPEN, Description: "Open" }
      : { StatusCode: IWS_ORDER_STATUS.CANCELED, Description: "Canceled" }
  }

  async getOrder(orderNumber: string) {
    const order = this.orders.get(orderNumber)
    if (!order) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `Orden simulada ${orderNumber} no existe`)
    }
    return order
  }

  async cancelOrder(orderNumber: string) {
    const order = await this.getOrder(orderNumber)
    this.orders.delete(orderNumber)
    return order
  }

  async calculateShippingRates(): Promise<IwsShippingRate[]> {
    return [{ Amount: 3, CurrencyId: "US", ServiceType: "Standard", Days: 2 }]
  }
}
