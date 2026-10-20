import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type Tile = {
  name: string
  handle: string
  blurb: string
  chips: [string, string][]
  accent: string
  featured?: boolean
  wide?: boolean
  image: string
  position: string
  // Velo sobre la foto: más fuerte donde la imagen es clara.
  veil: string
}

const TILES: Tile[] = [
  {
    name: "Gaming",
    handle: "gaming",
    blurb:
      "Tarjetas de video, procesadores, monitores y periféricos para competir al máximo.",
    chips: [
      ["Tarjetas de video", "tarjetas-de-video"],
      ["Procesadores", "procesadores"],
      ["Monitores gamer", "monitores-gamer"],
      ["Teclados", "teclados"],
      ["Mouse", "mouse"],
      ["Audífonos", "audifonos"],
      ["Sillas gamer", "sillas-gamer"],
    ],
    accent: "from-vio-600/50 via-neon-magenta/20 to-transparent",
    featured: true,
    image: "/zonas/gaming.jpg",
    position: "object-[50%_35%]",
    veil: "from-vio-950/90 via-vio-950/20 to-vio-950/90",
  },
  {
    name: "PC y Notebooks",
    handle: "pc-y-notebooks",
    blurb: "Equipos para trabajar, estudiar y crear.",
    chips: [
      ["Notebooks", "notebooks"],
      ["Escritorio", "computadores-de-escritorio"],
      ["Monitores", "monitores"],
    ],
    accent: "from-vio-700/50 via-vio-500/10 to-transparent",
    image: "/zonas/notebook.jpg",
    position: "object-[60%_50%]",
    veil: "from-vio-950/95 via-vio-950/75 to-vio-900/45",
  },
  {
    name: "Redes",
    handle: "redes",
    blurb: "Routers, switches y access points para una red estable.",
    chips: [
      ["Routers", "routers"],
      ["Switches", "switches"],
      ["Access Points", "access-points"],
    ],
    accent: "from-neon-cyan/30 via-vio-600/15 to-transparent",
    image: "/zonas/network.jpg",
    position: "object-[35%_50%]",
    veil: "from-vio-950/95 via-vio-950/60 to-vio-950/20",
  },
  {
    name: "Seguridad y CCTV",
    handle: "seguridad-y-cctv",
    blurb: "Cámaras, grabadores y control de acceso para proteger lo tuyo.",
    chips: [
      ["Cámaras IP", "camaras-ip"],
      ["NVR/DVR", "grabadores-nvr-dvr"],
      ["Alarmas", "alarmas"],
    ],
    accent: "from-neon-magenta/25 via-vio-700/20 to-transparent",
    wide: true,
    image: "/zonas/security.jpg",
    position: "object-[50%_45%]",
    veil: "from-vio-950/95 via-vio-950/70 to-vio-950/15",
  },
]

export default function CategoryTiles() {
  return (
    <section className="content-container py-20">
      <div className="mb-10 flex items-end justify-between gap-6">
        <h2 className="font-display text-3xl font-bold uppercase tracking-tight small:text-5xl">
          Elige tu <span className="text-rgb">zona</span>
        </h2>
      </div>

      <div className="grid gap-5 small:grid-cols-3 small:grid-rows-2">
        {TILES.map((t) => (
          <div
            key={t.handle}
            className={`glow-hover group relative overflow-hidden rounded-2xl border border-ui-border-base bg-ui-bg-base p-7 min-h-[260px] ${
              t.featured ? "rgb-border min-h-[420px] small:row-span-2 small:p-10" : "small:min-h-[300px]"
            } ${t.wide ? "small:col-span-2" : ""
            }`}
          >
            <Image
              src={t.image}
              alt=""
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className={`object-cover ${t.position} transition-transform duration-700 group-hover:scale-105`}
            />
            <div
              className={`pointer-events-none absolute inset-0 ${t.featured ? "bg-gradient-to-b" : "bg-gradient-to-t small:bg-gradient-to-r"} ${t.veil}`}
              aria-hidden="true"
            />
            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${t.accent} mix-blend-screen opacity-60 transition-opacity group-hover:opacity-90`}
              aria-hidden="true"
            />
            <div className="relative flex h-full flex-col justify-between gap-8">
              <div>
                <LocalizedClientLink
                  href={`/categories/${t.handle}`}
                  className="after:absolute after:inset-0"
                >
                  <h3
                    className={`font-display font-bold uppercase leading-none ${
                      t.featured ? "text-5xl small:text-6xl" : "text-3xl"
                    }`}
                  >
                    {t.name}
                  </h3>
                </LocalizedClientLink>
                <p className="mt-4 max-w-sm text-white/85">{t.blurb}</p>
              </div>
              <ul className="relative z-10 flex flex-wrap gap-2">
                {t.chips.map(([label, handle]) => (
                  <li key={handle}>
                    <LocalizedClientLink
                      href={`/categories/${handle}`}
                      className="rounded-full border border-white/25 bg-vio-950/50 px-3.5 py-1.5 text-sm text-white/90 backdrop-blur-sm transition-colors hover:border-neon-magenta hover:text-neon-magenta"
                    >
                      {label}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
