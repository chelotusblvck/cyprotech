import { buildOrderEmailData, etaFor, orderNumber, type OrderForEmail } from "../order-data"
import { sampleAlert, sampleDocument, sampleFor, sampleOrder } from "../samples"
import { esc, money } from "../layout"
import {
  TEMPLATES,
  isTemplateName,
  renderDocumentReady,
  renderInternalAlert,
  renderOrderConfirmed,
  renderOrderDelivered,
  renderOrderShipped,
  renderTemplate,
} from "../templates"

describe("layout", () => {
  it("escapa el HTML de los datos del cliente", () => {
    expect(esc(`<script>alert("x")</script> & 'a'`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;a&#39;")
  })

  it("formatea pesos chilenos con el signo antes del símbolo", () => {
    expect(money(1157640)).toBe("$1.157.640")
    expect(money(-20159)).toBe("-$20.159")
    expect(money(2899.6)).toBe("$2.900")
  })
})

describe("confirmación de pedido", () => {
  const email = renderOrderConfirmed(sampleOrder())

  it("trae el asunto, el número de pedido y el total", () => {
    expect(email.subject).toBe("Pedido CY1042 confirmado")
    expect(email.html).toContain("CY1042")
    expect(email.html).toContain("$1.157.640")
    expect(email.html).toContain("IVA incluido")
  })

  it("saluda por el nombre, muestra cada producto y el plazo de entrega", () => {
    expect(email.html).toContain("¡Gracias, Ana!")
    expect(email.html).toContain("GeForce RTX 4070 SUPER")
    expect(email.html).toContain("2 unidades")
    expect(email.html).toContain("2-4 días hábiles")
  })

  it("muestra los cuatro pasos y destaca el segundo", () => {
    for (const step of ["Pago confirmado", "Preparando", "En camino", "Entregado"]) {
      expect(email.html).toContain(step)
    }
  })

  it("avisa que el documento tributario llega aparte cuando todavía no existe", () => {
    expect(email.html).toContain("te llegará en un correo aparte")
  })

  it("enlaza el documento cuando ya está emitido", () => {
    const withDoc = renderOrderConfirmed({
      ...sampleOrder(),
      document: { label: "Boleta electrónica", folio: 109, url: "https://x.cl/documents/abc" },
    })
    expect(withDoc.html).toContain("Boleta electrónica N° 109")
    expect(withDoc.html).toContain("https://x.cl/documents/abc")
  })

  it("no inyecta HTML desde el nombre o el título de un producto", () => {
    const data = sampleOrder()
    data.customerName = `Ana <img src=x onerror=alert(1)>`
    data.items[0].title = `<b>hack</b>`
    const html = renderOrderConfirmed(data).html
    expect(html).not.toContain("<img src=x")
    expect(html).not.toContain("<b>hack</b>")
    expect(html).toContain("&lt;b&gt;hack&lt;/b&gt;")
  })

  it("muestra el descuento solo si lo hay y el despacho gratis", () => {
    expect(email.html).not.toContain("Descuento")
    const promo = renderOrderConfirmed({ ...sampleOrder(), discountTotal: 10000, shippingTotal: 0 }).html
    expect(promo).toContain("Descuento")
    expect(promo).toContain("-$10.000")
    expect(promo).toContain("Gratis")
  })

  it("incluye una versión de texto plano con lo esencial", () => {
    expect(email.text).toContain("CY1042")
    expect(email.text).toContain("$1.157.640")
    expect(email.text).toContain("Ver mi pedido")
    expect(email.text).not.toContain("<")
  })

  it("declara el modo oscuro y el texto previo", () => {
    expect(email.html).toContain('name="color-scheme" content="dark light"')
    expect(email.html).toContain("Recibimos tu pago")
  })
})

describe("despacho y entrega", () => {
  it("el correo de despacho muestra el seguimiento con transportista y número", () => {
    const email = renderOrderShipped(sampleOrder())
    expect(email.subject).toBe("Tu pedido CY1042 va en camino")
    expect(email.html).toContain("Starken")
    expect(email.html).toContain("7701234567")
    expect(email.html).toContain("Seguir mi envío")
  })

  it("sin número de seguimiento lo informa en vez de mostrar un hueco", () => {
    const email = renderOrderShipped({ ...sampleOrder(), tracking: [{ carrier: "Starken", number: null }] })
    expect(email.html).toContain("se informará pronto")
  })

  it("sin datos de seguimiento igual sale un correo válido", () => {
    const email = renderOrderShipped({ ...sampleOrder(), tracking: [] })
    expect(email.html).toContain("Seguimiento")
  })

  it("el de entrega completa todos los pasos y no promete garantías que no existen", () => {
    const email = renderOrderDelivered(sampleOrder())
    expect(email.subject).toBe("Tu pedido CY1042 fue entregado")
    expect(email.html).toContain("escríbenos y lo resolvemos")
    expect(email.html).not.toMatch(/devoluci[oó]n gratis|garant[ií]a de \d+/i)
  })
})

describe("documento tributario y alerta", () => {
  it("el correo del documento lleva folio, monto y enlace de descarga", () => {
    const email = renderDocumentReady(sampleDocument())
    expect(email.subject).toBe("Tu boleta electrónica N° 109 · Pedido CY1042")
    expect(email.html).toContain("Boleta electrónica N° 109")
    expect(email.html).toContain("$1.157.640")
    expect(email.html).toContain("Descargar documento")
    expect(email.html).toContain("adjunta")
  })

  it("una factura se nombra como factura", () => {
    const email = renderDocumentReady({ ...sampleDocument(), documentLabel: "Factura electrónica", folio: 3130 })
    expect(email.subject).toBe("Tu factura electrónica N° 3130 · Pedido CY1042")
  })

  it("la alerta interna muestra el motivo, el detalle y el acceso al dashboard", () => {
    const email = renderInternalAlert(sampleAlert())
    expect(email.subject).toBe("[Cyprotech] La boleta del pedido CY1042 no se pudo emitir")
    expect(email.html).toContain("RUT del receptor inválido")
    expect(email.html).toContain("Abrir el dashboard")
    expect(email.text).toContain("Intentos: 3")
  })
})

describe("registro de plantillas", () => {
  it("renderiza cualquier plantilla por nombre con sus datos de ejemplo", () => {
    for (const name of Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]) {
      const email = renderTemplate(name, sampleFor(name))
      expect(email.subject.length).toBeGreaterThan(5)
      expect(email.html.startsWith("<!doctype html>")).toBe(true)
      expect(email.text.length).toBeGreaterThan(10)
    }
  })

  it("reconoce solo plantillas existentes", () => {
    expect(isTemplateName("order-confirmed")).toBe(true)
    expect(isTemplateName("nada")).toBe(false)
  })

  it("el pie incluye el soporte y el crédito de la plataforma con su enlace", () => {
    const html = renderTemplate("order-confirmed", sampleOrder()).html
    expect(html).toContain("contacto@cyprotech.cl")
    expect(html).toContain("Plataforma desarrollada por")
    expect(html).toContain("https://garage360.cl")
  })
})

describe("buildOrderEmailData", () => {
  const order: OrderForEmail = {
    id: "order_01ABCDEF123456",
    display_id: 42,
    email: "ana@example.com",
    created_at: "2026-10-20T15:00:00Z",
    item_total: { numeric: 128400 } as unknown as number,
    shipping_total: 2900,
    discount_total: 0,
    total: { numeric: 131300 } as unknown as number,
    items: [
      {
        title: "Mouse",
        product_title: "Mouse gamer Logitech G502 X",
        variant_title: "Único",
        quantity: 1,
        unit_price: 128400,
        total: 128400,
      },
      { title: "Cable HDMI", variant_title: "2 metros", quantity: 2, unit_price: 5000, total: 10000 },
    ],
    shipping_address: {
      first_name: "Ana",
      last_name: "Pérez",
      address_1: "Av. Providencia 1234",
      city: "Providencia",
      province: "cl-rm",
    },
    shipping_methods: [{ name: "Despacho Santiago" }],
    payment_collections: [{ payments: [{ provider_id: "pp_flow_flow" }] }],
  }

  const data = buildOrderEmailData(order, { storefrontUrl: "https://cyprotech.cl" })

  it("arma el pedido con número, cliente y montos como números", () => {
    expect(data.orderNumber).toBe("CY42")
    expect(data.customerName).toBe("Ana Pérez")
    expect(data.total).toBe(131300)
    expect(data.subtotal).toBe(128400)
    expect(typeof data.total).toBe("number")
  })

  it("traduce la región, calcula el plazo y nombra el medio de pago", () => {
    expect(data.address.region).toBe("Región Metropolitana de Santiago")
    expect(data.eta).toBe("2-4 días hábiles")
    expect(data.paymentMethod).toBe("Flow (tarjeta, débito o transferencia)")
  })

  it("oculta la variante \"Único\" pero muestra las reales", () => {
    expect(data.items[0].variant).toBeNull()
    expect(data.items[1].variant).toBe("2 metros")
  })

  it("el enlace al pedido usa la URL pública de la tienda", () => {
    expect(data.orderUrl).toBe("https://cyprotech.cl/cl/order/order_01ABCDEF123456/confirmed")
  })

  it("el plazo depende de la zona y el número cae al id si no hay display id", () => {
    expect(etaFor("Despacho Regiones")).toBe("4-6 días hábiles")
    expect(etaFor("Retiro")).toBe("los próximos días hábiles")
    expect(orderNumber({ id: "order_01ABCDEF123456", display_id: null })).toBe("CY123456")
  })
})
