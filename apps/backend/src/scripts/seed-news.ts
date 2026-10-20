import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { NEWS_MODULE } from "../modules/news"
import type NewsModuleService from "../modules/news/service"

// Notas de arranque: guías propias, atemporales, sin cifras ni fechas de terceros. Sirven para ver
// la sección con contenido y como modelo de tono. Se pueden editar o despublicar desde el admin.
// Es idempotente: si el slug ya existe, no lo repite.
const POSTS = [
  {
    slug: "como-elegir-tarjeta-de-video-segun-tu-monitor",
    title: "Cómo elegir tu tarjeta de video según tu monitor",
    summary: "La resolución y los hertz de tu pantalla deciden cuánta tarjeta de video necesitas. Una guía rápida para no gastar de más.",
    category: "hardware",
    game: "hardware",
    body: "Antes de mirar modelos, mira tu monitor. A 1080p la mayoría de las tarjetas actuales rinde de sobra; en 1440p y 4K el trabajo se multiplica y ahí sí conviene subir de gama.\n\nLa tasa de refresco también cuenta: un monitor de 144 Hz o más pide que la tarjeta entregue esos cuadros por segundo, y en juegos competitivos conviene priorizar fluidez sobre calidad gráfica máxima.\n\nSi vas a cambiar de monitor pronto, compra pensando en el nuevo, no en el actual. Y revisa que tu fuente de poder y tu gabinete tengan espacio y potencia para la tarjeta elegida.",
    days: 1,
  },
  {
    slug: "valorant-que-hardware-necesitas-para-jugar-fluido",
    title: "Valorant: qué hardware necesitas para jugar fluido",
    summary: "Es un juego liviano, pero la competencia premia los cuadros por segundo. Monitor, mouse y conexión pesan más que la tarjeta de video.",
    category: "esports",
    game: "valorant",
    body: "Valorant no exige una tarjeta de gama alta, pero sí agradece un procesador rápido y un monitor de alta frecuencia. Pasar de 60 a 144 Hz o más cambia la forma en que ves los movimientos rápidos.\n\nEl mouse y el teclado también marcan diferencia: busca baja latencia y un sensor preciso. Y si juegas en línea, una conexión por cable estable vale más que cualquier mejora gráfica.",
    days: 2,
  },
  {
    slug: "league-of-legends-procesador-o-tarjeta-de-video",
    title: "League of Legends: ¿procesador o tarjeta de video?",
    summary: "Para jugar a muchos cuadros por segundo, el procesador suele ser el protagonista. Cómo repartir el presupuesto de tu equipo.",
    category: "esports",
    game: "lol",
    body: "En juegos como LoL, a partir de cierto punto el límite lo pone el procesador, no la tarjeta de video. Si tu meta son muchos cuadros por segundo y poco tirón en las peleas grandes, prioriza un buen procesador y memoria rápida.\n\nUna tarjeta de video de gama media alcanza de sobra. Lo que sobre del presupuesto, ponlo en un SSD, que acelera la carga de cada partida, y en un monitor de buena frecuencia.",
    days: 4,
  },
  {
    slug: "overwatch-ping-bajo-y-red-estable",
    title: "Overwatch y los juegos de equipo: ping bajo y red estable",
    summary: "En un juego cooperativo, un corte de conexión le cuesta la partida a cinco personas. Cómo mejorar tu red en casa.",
    category: "guias",
    game: "overwatch",
    body: "Siempre que puedas, conecta tu equipo por cable: es la mejora más simple y más efectiva contra el ping alto. Si debes usar Wi-Fi, acércate al router y prefiere la banda de 5 GHz.\n\nUn router con buena gestión de tráfico ayuda cuando hay más personas usando la red. Y unos audífonos con micrófono claro hacen que coordinarse sea mucho más fácil.",
    days: 6,
  },
  {
    slug: "futbol-competitivo-monitores-de-alta-frecuencia",
    title: "Fútbol competitivo: por qué importa un monitor de alta frecuencia",
    summary: "En un partido rápido, cada milisegundo cuenta. Qué mirar en un monitor si juegas simuladores de fútbol en línea.",
    category: "hardware",
    game: "fifa",
    body: "Los simuladores de fútbol se juegan a ritmo alto y con reacciones cortas. Un monitor de 144 Hz o más muestra el movimiento con más suavidad, y un tiempo de respuesta bajo reduce el rastro en pantalla.\n\nRevisa también la entrada de video de tu consola o tarjeta: para aprovechar la frecuencia alta necesitas el cable y el puerto adecuados.",
    days: 8,
  },
  {
    slug: "halo-y-las-campanas-1440p-o-4k",
    title: "Campañas épicas: ¿1440p o 4K?",
    summary: "Los juegos de campaña lucen enormes en alta resolución, pero 4K pide mucho a tu tarjeta. Cómo decidir sin arrepentirte.",
    category: "hardware",
    game: "halo",
    body: "Para disfrutar una campaña con detalle, la resolución importa. Pero 4K exige varias veces el trabajo de 1080p, y mantener una buena fluidez a esa resolución requiere una tarjeta de gama alta.\n\nEl 1440p suele ser el punto dulce: se ve nítido y deja margen para activar buenos efectos sin sacrificar cuadros por segundo. Si quieres 4K, planifica la tarjeta antes que el monitor.",
    days: 10,
  },
  {
    slug: "prepara-tu-pc-para-los-grandes-lanzamientos",
    title: "Prepara tu PC para los grandes lanzamientos",
    summary: "Antes de que salga el próximo juego esperado, revisa tu equipo. Cuatro puntos que conviene tener al día.",
    category: "lanzamientos",
    game: "gta",
    body: "Cuando se anuncia un gran lanzamiento, los requisitos oficiales aparecen recién unas semanas antes. Mientras tanto, puedes dejar tu equipo al día: un SSD con espacio libre, suficiente memoria, controladores de video actualizados y buena ventilación.\n\nCuando se publiquen los requisitos oficiales, compáralos con tu equipo antes de decidir una mejora, y apunta a la configuración recomendada, no a la mínima.",
    days: 12,
  },
  {
    slug: "como-armar-tu-puesto-para-torneos-en-casa",
    title: "Cómo armar tu puesto para torneos en casa",
    summary: "Silla, pantalla, audio y red: lo esencial para competir cómodo durante horas.",
    category: "esports",
    game: "esports",
    body: "Un torneo puede durar horas, así que la comodidad también es rendimiento. Elige una silla con buen soporte, ubica el monitor a la altura de los ojos y deja espacio para mover el mouse con libertad.\n\nEn lo técnico, cuida el audio, que te permite oír pasos y coordinar con tu equipo, y una conexión por cable estable. Y deja los controladores y las actualizaciones listos el día anterior.",
    days: 14,
  },
]

export default async function seedNews({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service: NewsModuleService = container.resolve(NEWS_MODULE)
  const existing = new Set((await service.listNewsPosts({}, { select: ["slug"], take: 5000 })).map((post) => post.slug))

  let created = 0
  for (const post of POSTS) {
    if (existing.has(post.slug)) {
      continue
    }
    const { days, ...data } = post
    await service.createNewsPosts({
      ...data,
      status: "published",
      origin: "manual",
      featured: false,
      published_at: new Date(Date.now() - days * 86_400_000),
    })
    created += 1
  }
  logger.info(`Novedades de ejemplo: ${created} creadas, ${POSTS.length - created} ya existían.`)
}
