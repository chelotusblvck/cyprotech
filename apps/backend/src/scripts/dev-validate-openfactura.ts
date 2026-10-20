import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { OpenFacturaClient, OpenFacturaError } from "../modules/billing/client"
import { buildBoleta, buildCreditNote, buildFactura, linesFromOrder } from "../modules/billing/dte"
import type { Emisor, OrderForBilling } from "../modules/billing/types"

// SOLO DESARROLLO. Emite documentos de prueba en el ambiente de desarrollo de OpenFactura para
// comprobar que los documentos que arma la tienda son válidos. Usa la API Key y la empresa de prueba
// que OpenFactura publica en su documentación (https://docsapi-openfactura.haulmer.com); allí las
// emisiones son simuladas (CAF de prueba) y no llegan al SII.
// Uso: npx medusa exec ./src/scripts/dev-validate-openfactura.ts
const PUBLIC_TEST_API_KEY = "928e15a2d14d4a6292345f04960f4bd3"

const TEST_EMISOR: Emisor = {
  rut: "76795561-8",
  razonSocial: "HAULMER SPA",
  giro: "VENTA AL POR MENOR EN EMPRESAS DE VENTA A DISTANCIA VÍA INTERNET; COMERCIO ELEC",
  acteco: 479100,
  direccion: "ARTURO PRAT 527   CURICO",
  comuna: "Curicó",
  codigoSucursal: "81303347",
}

const order: OrderForBilling = {
  id: "order_validacion",
  display_id: 1,
  created_at: new Date().toISOString(),
  total: 374360,
  shipping_total: 2900,
  items: [{ product_title: "Tarjeta de video MSI GeForce RTX 4060 Ventus 2X 8GB", quantity: 1, unit_price: 371460, total: 371460 }],
}

export default async function validate({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const client = new OpenFacturaClient({
    apiKey: PUBLIC_TEST_API_KEY,
    environment: "dev",
    baseUrl: "https://dev-api.haulmer.com",
    timeoutMs: 60_000,
  })
  const run = Date.now().toString(36)
  const lines = linesFromOrder(order)
  const now = new Date()

  const attempt = async (name: string, fn: () => Promise<unknown>) => {
    try {
      logger.info(`${name}: OK ${JSON.stringify(await fn())}`)
    } catch (error) {
      const e = error as OpenFacturaError
      logger.error(`${name}: FALLÓ ${e.message} ${JSON.stringify(e.details ?? "")}`)
    }
  }

  let boleta: { token: string; folio: number } | undefined
  await attempt("Boleta (39)", async () => {
    const request = buildBoleta({ lines, total: order.total, emisor: TEST_EMISOR, date: now })
    boleta = await client.emit(request, `validacion-boleta-${run}`)
    return boleta
  })

  if (boleta) {
    await attempt("Idempotencia (misma clave)", async () => {
      const request = buildBoleta({ lines, total: order.total, emisor: TEST_EMISOR, date: now })
      const again = await client.emit(request, `validacion-boleta-${run}`)
      return { igualFolio: again.folio === boleta!.folio, igualToken: again.token === boleta!.token }
    })
    await attempt("Estado en el SII", async () => client.getStatus(boleta!.token))
    await attempt("PDF", async () => {
      const pdf = await client.getPdf(boleta!.token)
      return { bytes: pdf.length, cabecera: pdf.subarray(0, 5).toString() }
    })
    await attempt("Nota de crédito que anula la boleta (61)", async () => {
      const request = buildCreditNote({
        original: { type: 39, folio: boleta!.folio, date: now.toISOString().slice(0, 10), lines, total: order.total },
        emisor: TEST_EMISOR,
        reason: "Anula boleta por devolución",
        date: now,
      })
      return client.emit(request, `validacion-nc-${run}`)
    })
  }

  await attempt("Boleta con RUT del cliente", async () => {
    const request = buildBoleta({
      lines,
      total: order.total,
      emisor: TEST_EMISOR,
      receptorRut: "12345678-5",
      receptorName: "Ana Pérez",
      date: now,
    })
    return client.emit(request, `validacion-boleta-rut-${run}`)
  })

  await attempt("Factura (33)", async () => {
    const request = buildFactura({
      lines,
      total: order.total,
      emisor: TEST_EMISOR,
      receptor: {
        rut: "76430498-5",
        razonSocial: "HOSTY SPA",
        giro: "EMPRESAS DE SERVICIOS INTEGRALES DE INFORMATICA",
        direccion: "ARTURO PRAT 527 3 pis OF 1",
        comuna: "Curicó",
      },
      date: now,
    })
    return client.emit(request, `validacion-factura-${run}`)
  })
}
