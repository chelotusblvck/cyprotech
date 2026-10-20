import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { placeIntcomexOrderWorkflow } from "../../../../../../workflows/place-intcomex-order"

// Coloca (o reintenta) a mano el pedido de la tienda en Intcomex. Es idempotente: si ya
// estaba colocado devuelve el pedido existente sin crear otro.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { result } = await placeIntcomexOrderWorkflow(req.scope).run({
      input: { orderId: req.params.id },
    })
    res.status(result.ok ? 200 : 422).json(result)
  } catch (error) {
    const message = (error as Error).message
    res.status(message.startsWith("No existe el pedido") ? 404 : 500).json({ message })
  }
}
