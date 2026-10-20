import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import { loadFlowConfig, simulateFlowResult } from "../../../../modules/flow/client"

const bodySchema = z.object({
  token: z.string().min(1),
  result: z.enum(["paid", "rejected", "canceled"]),
})

// Solo para desarrollo con el Flow simulado: fija el resultado del pago como lo haría el cliente
// en la página de Flow. Con credenciales reales o en producción no existe.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (loadFlowConfig() !== null || process.env.NODE_ENV === "production") {
    res.sendStatus(404)
    return
  }
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "Parámetros inválidos" })
    return
  }
  const order = simulateFlowResult(parsed.data.token, parsed.data.result)
  if (!order) {
    res.status(404).json({ message: "No existe esa orden simulada." })
    return
  }
  res.json({ ok: true, amount: order.amount, commerceOrder: order.commerceOrder })
}
