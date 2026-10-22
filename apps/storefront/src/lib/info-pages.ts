// Paginas informativas (como comprar, devoluciones, contacto, terminos, privacidad, preguntas frecuentes).
// BORRADOR: los textos son propios y generales. Donde falta un dato del negocio hay un marcador [COMPLETAR];
// los textos legales deben ser revisados por el titular o un abogado antes de publicarse. Mientras
// exista algun [COMPLETAR], la pagina se marca como noindex (ver app/[countryCode]/(main)/[page]).

export type InfoSection = {
  heading: string
  paragraphs?: string[]
  list?: string[]
}

export type InfoPage = {
  slug: string
  title: string
  description: string
  intro?: string
  sections: InfoSection[]
}

// Datos de contacto: completar con los reales antes de publicar.
export const CONTACT = {
  email: "[COMPLETAR correo de contacto]",
  salesEmail: "[COMPLETAR correo de ventas o soporte]",
  phone: "[COMPLETAR telefono o WhatsApp]",
  hours: "[COMPLETAR horario de atencion]",
  legalName: "[COMPLETAR razon social]",
  rut: "[COMPLETAR RUT]",
  address: "[COMPLETAR domicilio legal]",
}

export const INFO_PAGES: InfoPage[] = [
  {
    slug: "como-comprar",
    title: "Cómo comprar",
    description: "Paso a paso para comprar en Cyprotech: elegir, pagar con Flow y recibir en tu domicilio.",
    intro: "Comprar en Cyprotech toma pocos minutos. Estos son los pasos.",
    sections: [
      {
        heading: "1. Encuentra tu producto",
        paragraphs: [
          "Usa el buscador de la parte superior o recorre las categorías. Puedes ordenar por precio y filtrar por categoría para comparar opciones.",
        ],
      },
      {
        heading: "2. Agrégalo al carrito",
        paragraphs: [
          "En la ficha del producto presiona Agregar al carrito. Puedes seguir comprando y revisar el carrito cuando quieras.",
        ],
      },
      {
        heading: "3. Ingresa tus datos y elige el despacho",
        paragraphs: [
          "En el checkout indica tus datos de contacto y la dirección de entrega. El costo de despacho se muestra antes de pagar.",
          "Si necesitas factura, selecciónala en el checkout e ingresa los datos de tu empresa (RUT, razón social y giro). Si no, recibirás boleta electrónica.",
        ],
      },
      {
        heading: "4. Paga de forma segura con Flow",
        paragraphs: [
          "Los pagos se procesan a través de Flow, un proveedor de pagos con medios de pago habilitados en Chile. Tus datos de pago los ingresas en la plataforma de Flow; Cyprotech no los almacena.",
        ],
      },
      {
        heading: "5. Recibe tu pedido",
        paragraphs: [
          "Te enviaremos un correo de confirmación y, cuando salga el despacho, el número de seguimiento. Los plazos estimados son de 2 a 4 días hábiles en Santiago y de 4 a 6 días hábiles en regiones.",
        ],
      },
    ],
  },
  {
    slug: "cambios-y-devoluciones",
    title: "Cambios y devoluciones",
    description: "Garantía, cambios y devoluciones de tus compras en Cyprotech.",
    intro:
      "BORRADOR sujeto a revisión legal. Resume tus derechos como consumidor y cómo gestionamos los casos más comunes.",
    sections: [
      {
        heading: "Garantía legal",
        paragraphs: [
          "Si un producto nuevo presenta una falla o no corresponde a lo ofrecido, tienes derecho a la garantía legal que establece la Ley 19.496 sobre Protección de los Derechos de los Consumidores, dentro de los plazos que esa ley define. [COMPLETAR/REVISAR: plazos y opciones de la garantía legal según corresponda].",
          "Además, los productos cuentan con la garantía del fabricante, cuyas condiciones dependen de cada marca.",
        ],
      },
      {
        heading: "Cómo solicitar un cambio o devolución",
        list: [
          "Escríbenos a " + CONTACT.email + " indicando tu número de pedido y el motivo.",
          "Conserva el producto con su embalaje, accesorios y comprobante de compra.",
          "Te responderemos con los pasos a seguir y, si corresponde, cómo enviarnos el producto.",
        ],
      },
      {
        heading: "Derecho de retracto",
        paragraphs: [
          "Las compras a distancia pueden tener derecho de retracto según la ley y sus excepciones. [COMPLETAR/REVISAR: condiciones del retracto, plazo y excepciones aplicables a los productos que vendemos].",
        ],
      },
      {
        heading: "Reembolsos",
        paragraphs: [
          "Cuando una devolución corresponde, el reembolso se realiza por el mismo medio de pago utilizado en la compra. [COMPLETAR: plazo en que se procesa el reembolso].",
        ],
      },
    ],
  },
  {
    slug: "contacto",
    title: "Contacto",
    description: "Cómo comunicarte con Cyprotech. Atención online, sin tienda física.",
    intro:
      "Cyprotech es una tienda online y no tiene tienda física. Escríbenos y te respondemos lo antes posible.",
    sections: [
      {
        heading: "Escríbenos",
        list: [
          "Correo: " + CONTACT.email,
          "Ventas y soporte: " + CONTACT.salesEmail,
          "Teléfono / WhatsApp: " + CONTACT.phone,
          "Horario de atención: " + CONTACT.hours,
        ],
      },
      {
        heading: "Antes de escribir",
        paragraphs: [
          "Si consultas por un pedido, incluye tu número de pedido y el correo con el que compraste para ayudarte más rápido.",
        ],
      },
      {
        heading: "Datos de la empresa",
        list: [
          "Razón social: " + CONTACT.legalName,
          "RUT: " + CONTACT.rut,
          "Domicilio: " + CONTACT.address,
        ],
      },
    ],
  },
  {
    slug: "preguntas-frecuentes",
    title: "Preguntas frecuentes",
    description: "Respuestas rápidas sobre pagos, despacho, facturas y garantía.",
    sections: [
      {
        heading: "¿Qué medios de pago aceptan?",
        paragraphs: ["Los pagos se procesan con Flow. En el checkout verás los medios de pago habilitados."],
      },
      {
        heading: "¿Cuánto demora mi pedido?",
        paragraphs: [
          "Santiago: 2 a 4 días hábiles. Regiones: 4 a 6 días hábiles. Recibirás el número de seguimiento por correo.",
        ],
      },
      {
        heading: "¿Puedo pedir factura?",
        paragraphs: [
          "Sí. En el checkout elige factura e ingresa RUT, razón social y giro. La factura electrónica te llegará por correo.",
        ],
      },
      {
        heading: "¿Los productos tienen garantía?",
        paragraphs: [
          "Sí, todos cuentan con garantía del fabricante y con la garantía legal. Revisa Cambios y devoluciones para más detalles.",
        ],
      },
      {
        heading: "¿El stock que veo es real?",
        paragraphs: [
          "Los productos se despachan desde nuestro proveedor. Si algún producto no estuviera disponible al procesar tu pedido, te contactaremos para ofrecerte una alternativa o el reembolso.",
        ],
      },
    ],
  },
  {
    slug: "terminos-y-condiciones",
    title: "Términos y condiciones",
    description: "Condiciones de uso del sitio y de compra en Cyprotech.",
    intro: "BORRADOR sujeto a revisión legal. No publicar sin revisar.",
    sections: [
      {
        heading: "1. Titular del sitio",
        paragraphs: [
          "Este sitio es operado por " + CONTACT.legalName + ", RUT " + CONTACT.rut + ", con domicilio en " + CONTACT.address + ".",
        ],
      },
      {
        heading: "2. Aceptación",
        paragraphs: [
          "Al navegar o comprar en este sitio aceptas estos términos. Si no estás de acuerdo, te pedimos no utilizarlo.",
        ],
      },
      {
        heading: "3. Precios, disponibilidad y pago",
        paragraphs: [
          "Los precios se muestran en pesos chilenos e incluyen IVA, salvo que se indique lo contrario. El costo de despacho se informa antes de pagar. La disponibilidad puede variar; si un producto no pudiera entregarse, te contactaremos y podrás elegir una alternativa o el reembolso.",
          "Los pagos se procesan a través de Flow. Cyprotech no almacena los datos de tu medio de pago.",
        ],
      },
      {
        heading: "4. Despacho",
        paragraphs: ["Los plazos informados son estimados y pueden verse afectados por factores ajenos a nosotros."],
      },
      {
        heading: "5. Garantías, cambios y devoluciones",
        paragraphs: ["Se rigen por la Ley 19.496 y por la página Cambios y devoluciones. [COMPLETAR/REVISAR]"],
      },
      {
        heading: "6. Propiedad intelectual",
        paragraphs: [
          "Los contenidos del sitio son de Cyprotech o de sus titulares. Los nombres y logos de marcas pertenecen a sus propietarios.",
        ],
      },
      {
        heading: "7. Legislación y contacto",
        paragraphs: [
          "Estos términos se rigen por las leyes de Chile. Para consultas escríbenos a " + CONTACT.email + ". [COMPLETAR/REVISAR: tribunales competentes y demás cláusulas].",
        ],
      },
    ],
  },
  {
    slug: "politica-de-privacidad",
    title: "Política de privacidad",
    description: "Cómo Cyprotech trata tus datos personales.",
    intro: "BORRADOR sujeto a revisión legal. No publicar sin revisar.",
    sections: [
      {
        heading: "Qué datos recopilamos",
        list: [
          "Datos de contacto y entrega: nombre, correo, teléfono y dirección.",
          "Datos tributarios cuando pides factura: RUT, razón social y giro.",
          "Información de tu pedido y de tu navegación en el sitio.",
        ],
      },
      {
        heading: "Para qué los usamos",
        list: [
          "Procesar y despachar tus compras y emitir tu boleta o factura electrónica.",
          "Atender tus consultas y gestionar cambios y devoluciones.",
          "Cumplir obligaciones legales y tributarias.",
        ],
      },
      {
        heading: "Con quién los compartimos",
        paragraphs: [
          "Solo con los proveedores necesarios para operar: el procesador de pagos (Flow), el emisor de documentos tributarios, el proveedor logístico y el proveedor de los productos. [COMPLETAR/REVISAR: lista final de proveedores].",
        ],
      },
      {
        heading: "Tus derechos",
        paragraphs: [
          "Puedes solicitar acceso, rectificación o eliminación de tus datos escribiendo a " + CONTACT.email + ". [COMPLETAR/REVISAR según la normativa de protección de datos vigente].",
        ],
      },
    ],
  },
]

export const getInfoPage = (slug: string) => INFO_PAGES.find((page) => page.slug === slug)

// Una pagina esta incompleta mientras conserve algun marcador [COMPLETAR].
export const isDraftPage = (page: InfoPage) =>
  JSON.stringify(page).includes("[COMPLETAR") || (page.intro ?? "").includes("BORRADOR")
