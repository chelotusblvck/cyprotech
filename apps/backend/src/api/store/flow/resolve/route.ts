import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import { settleFlowPayment } from "../../../../modules/flow/settle"

const bodySchema = z.object({ token: z.string().min(1).max(200) })

// La tienda llama aquí cuando Flow devuelve al cliente. Se verifica el pago con Flow y, si está
// pagado, se asegura que el pedido exista; la respuesta indica a qué pantalla llevar al cliente.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "Falta el token." })
    return
  }
  try {
    res.json(await settleFlowPayment(req.scope, parsed.data.token))
  } catch (error) {
    res.status(502).json({ message: (error as Error).message })
  }
}
