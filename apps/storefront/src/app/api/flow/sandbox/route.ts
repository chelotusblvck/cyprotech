import { NextRequest, NextResponse } from "next/server"

const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

const page = (body: string, status = 200) =>
  new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Flow (simulado)</title></head><body style="font-family:system-ui;background:#0a0614;color:#f6f2ff;display:grid;place-items:center;min-height:100vh;margin:0">${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  )

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string)

// Página de pago de PRUEBA que reemplaza a Flow mientras no hay credenciales (el backend usa un
// Flow simulado). No existe en producción.
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 })
  }
  const token = req.nextUrl.searchParams.get("token") ?? ""
  const button = (result: string, label: string, color: string) =>
    `<button name="result" value="${result}" style="padding:12px 20px;border:0;border-radius:8px;background:${color};color:#fff;font-size:16px;cursor:pointer">${label}</button>`
  return page(
    `<form method="post" style="max-width:420px;padding:32px;border:1px solid #4c1d95;border-radius:16px;background:#100a20;text-align:center"><p style="color:#c084fc;font-size:13px;margin:0 0 8px">FLOW SIMULADO (solo desarrollo)</p><h1 style="margin:0 0 8px;font-size:22px">Pago de prueba</h1><p style="color:#b8acde;margin:0 0 24px">Elige cómo termina este pago. No se cobra nada.</p><input type="hidden" name="token" value="${escape(token)}"><div style="display:flex;gap:12px;justify-content:center">${button("paid", "Pagar", "#7c3aed")}${button("rejected", "Rechazar", "#4b3a82")}${button("canceled", "Cancelar", "#4b3a82")}</div></form>`,
  )
}

// Aplica el resultado en el Flow simulado y devuelve al cliente como lo haría Flow: primero el
// aviso al backend (urlConfirmation) y luego el POST de retorno a la tienda (urlReturn).
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 })
  }
  const form = await req.formData()
  const token = String(form.get("token") ?? "")
  const result = String(form.get("result") ?? "")

  const simulated = await fetch(`${BACKEND}/hooks/flow/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, result }),
    cache: "no-store",
  })
  if (!simulated.ok) {
    return page(`<p>No se pudo simular el pago (${simulated.status}).</p>`, 502)
  }

  // Flow avisa al backend por su cuenta, aunque el cliente no vuelva a la tienda.
  await fetch(`${BACKEND}/hooks/flow/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }).toString(),
    cache: "no-store",
  }).catch(() => null)

  return page(
    `<form id="back" method="post" action="/api/flow/return"><input type="hidden" name="token" value="${escape(token)}"></form><p>Volviendo a la tienda...</p><script>document.getElementById("back").submit()</script>`,
  )
}
