export type HeroSlide = {
  id: string
  kicker: string
  title: string
  // Segunda parte del titular, con el degradado de marca.
  highlight?: string
  text: string
  image: string
  cta: { label: string; href: string }
  secondary?: { label: string; href: string }
}

// Para usar arte oficial, reemplaza el archivo de `image` por el del editor (misma ruta o una nueva) y
// agrega el crédito en la tienda. El texto y el enlace de cada slide se editan aquí.
export const HERO_SLIDES: HeroSlide[] = [
  {
    id: "cyprotech",
    kicker: "Despacho directo a todo Chile",
    title: "Sube de nivel",
    highlight: "tu setup",
    text: "Tarjetas de video, procesadores, periféricos, redes y seguridad. Hardware de las mejores marcas, con envío en 2-4 días hábiles en Santiago.",
    image: "/hero/hardware.jpg",
    cta: { label: "Ver la tienda", href: "/store" },
    secondary: { label: "Zona Gaming", href: "/categories/gaming" },
  },
  {
    id: "gta",
    kicker: "Lo más esperado",
    title: "GTA VI",
    highlight: "se acerca",
    text: "Llega la próxima gran generación de mundos abiertos. Prepara tu setup con hardware que no se queda corto.",
    image: "/hero/gta.jpg",
    cta: { label: "Tarjetas de video", href: "/categories/tarjetas-de-video" },
    secondary: { label: "Procesadores", href: "/categories/procesadores" },
  },
  {
    id: "fifa",
    kicker: "Fútbol competitivo",
    title: "EA SPORTS FC",
    highlight: "a más FPS",
    text: "Cada partido se decide en milisegundos. Monitores de alta frecuencia y periféricos de respuesta inmediata.",
    image: "/hero/fifa.jpg",
    cta: { label: "Monitores gamer", href: "/categories/monitores-gamer" },
    secondary: { label: "Mouse", href: "/categories/mouse" },
  },
  {
    id: "halo",
    kicker: "Campaña y multijugador",
    title: "Halo",
    highlight: "en alta definición",
    text: "Gráficos que se ven como deben verse. Elige la tarjeta de video para jugar a tu resolución.",
    image: "/hero/halo.jpg",
    cta: { label: "Tarjetas de video", href: "/categories/tarjetas-de-video" },
    secondary: { label: "Monitores gamer", href: "/categories/monitores-gamer" },
  },
  {
    id: "valorant",
    kicker: "Shooter táctico",
    title: "Valorant",
    highlight: "cada frame cuenta",
    text: "Alta tasa de refresco, teclado rápido y mouse preciso: lo que separa una ronda ganada de una perdida.",
    image: "/hero/valorant.jpg",
    cta: { label: "Teclados", href: "/categories/teclados" },
    secondary: { label: "Mouse", href: "/categories/mouse" },
  },
  {
    id: "lol",
    kicker: "Esport de masas",
    title: "League of Legends",
    highlight: "sube de rango",
    text: "Un procesador sólido y una buena conexión marcan la diferencia en la grieta.",
    image: "/hero/lol.jpg",
    cta: { label: "Procesadores", href: "/categories/procesadores" },
    secondary: { label: "Redes", href: "/categories/redes" },
  },
  {
    id: "overwatch",
    kicker: "Juego en equipo",
    title: "Overwatch",
    highlight: "ping bajo, comunicación clara",
    text: "Audífonos con micrófono y una red estable para coordinar cada jugada.",
    image: "/hero/overwatch.jpg",
    cta: { label: "Audífonos", href: "/categories/audifonos" },
    secondary: { label: "Redes", href: "/categories/redes" },
  },
  {
    id: "esports",
    kicker: "Juegos competitivos",
    title: "Tu setup",
    highlight: "para ganar",
    text: "Del torneo online a la liga: equipa tu puesto de batalla con lo mejor de cada categoría.",
    image: "/hero/esports.jpg",
    cta: { label: "Zona Gaming", href: "/categories/gaming" },
    secondary: { label: "Ver novedades", href: "/novedades" },
  },
]
