import { sdk } from "@lib/config"
import { placeOrder } from "@lib/data/cart"
import { removeCartId, setCartId } from "@lib/data/cookies"
import { unstable_rethrow } from "next/navigation"
import { NextRequest, NextResponse } from "next/server"

const COUNTRY = (process.env.NEXT_PUBLIC_DEFAULT_REGION || "cl").toLowerCase()

type ResolveResult = {
  state: "paid" | "pending" | "rejected" | "canceled" | "unknown"
  cartId?: string
  orderId?: string
  error?: string
}

const html = (body: string) =>
  new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  })

// Flow devuelve al cliente con un POST (el token viene en el cuerpo). Las cookies de la tienda
// son SameSite=Strict y no viajan en una navegación POST que viene de otro sitio, así que se
// responde una página mínima que entra de nuevo por GET desde nuestro propio sitio, ya con la
// sesión del cliente.
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const token = String(form?.get("token") ?? req.nextUrl.searchParams.get("token") ?? "")
  const target = `/api/flow/return?token=${encodeURIComponent(token)}`
  return html(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${target}"><title>Confirmando tu pago</title></head><body style="font-family:system-ui;background:#0a0614;color:#f6f2ff;display:grid;place-items:center;min-height:100vh;margin:0"><p>Confirmando tu pago...</p><script>location.replace(${JSON.stringify(target)})</script></body></html>`,
  )
}

// Verifica el pago con Flow (a través del backend) y lleva al cliente a la pantalla que
// corresponde: pedido confirmado, o de vuelta al paso de pago con el motivo.
export async function GET(req: NextRequest) {
  const { origin, searchParams } = req.nextUrl
  const token = searchParams.get("token")?.trim()
  const to = (path: string) => NextResponse.redirect(`${origin}/${COUNTRY}${path}`)

  if (!token) {
    return to("/cart")
  }

  const result = await sdk.client
    .fetch<ResolveResult>("/store/flow/resolve", {
      method: "POST",
      body: { token },
      cache: "no-store",
    })
    .catch((): ResolveResult => ({ state: "unknown" }))

  if (result.state === "rejected" || result.state === "canceled") {
    if (result.cartId) {
      await setCartId(result.cartId)
    }
    return to("/checkout?step=payment&payment_error=flow_failed")
  }

  if (result.state === "pending") {
    if (result.cartId) {
      await setCartId(result.cartId)
    }
    return to("/checkout?step=review&payment_error=flow_pending")
  }

  if (result.state !== "paid" || !result.cartId) {
    return to("/cart?error=payment_failed")
  }

  await setCartId(result.cartId)
  try {
    // El backend ya creó el pedido; completar el carrito de nuevo devuelve ese mismo pedido y
    // deja limpia la sesión de la tienda (carrito, cachés).
    await placeOrder(result.cartId)
  } catch (error) {
    unstable_rethrow(error)
    if (result.orderId) {
      await removeCartId()
      return to(`/order/${result.orderId}/confirmed`)
    }
    return to("/cart?error=order_failed")
  }

  if (result.orderId) {
    await removeCartId()
    return to(`/order/${result.orderId}/confirmed`)
  }
  // Pago confirmado pero el pedido aún no está listo (el aviso de Flow puede tardar unos segundos).
  return to("/checkout?step=review&payment_error=flow_pending")
}
