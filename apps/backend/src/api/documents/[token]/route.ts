import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { createOpenFacturaApi } from "../../../modules/billing/client"
import { BILLING_MODULE } from "../../../modules/billing"
import type BillingModuleService from "../../../modules/billing/service"
import { documentFileName } from "../../../modules/billing/types"

// Descarga pública de una boleta o factura por su token. Es el enlace del correo del cliente: el token
// de OpenFactura es largo e imposible de adivinar, y solo se sirven documentos emitidos por esta tienda.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: BillingModuleService = req.scope.resolve(BILLING_MODULE)
  const token = req.params.token
  // Token de OpenFactura (hexadecimal largo) o del servicio de boletas ("folio-codigo": el código no se puede adivinar; el
  // folio solo sí, por eso nunca se acepta solo).
  const [doc] = /^([0-9a-f]{32,128}|\d+-[0-9a-f]{16})$/i.test(token)
    ? await service.listBillingDocuments({ token, state: "issued" })
    : []
  if (!doc) {
    res.status(404).json({ message: "Documento no encontrado." })
    return
  }
  try {
    const pdf = await createOpenFacturaApi().getPdf(token)
    const name = documentFileName(doc.tipo_dte, doc.folio)
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `inline; filename="${name}"`)
    res.setHeader("Cache-Control", "private, max-age=300")
    res.send(pdf)
  } catch {
    res.status(502).json({ message: "No pudimos generar el documento en este momento. Intenta de nuevo en unos minutos." })
  }
}
