import LocalizedClientLink from "@modules/common/components/localized-client-link"

const Hero = () => {
  return (
    <section className="relative isolate overflow-hidden border-b border-ui-border-base">
      <div className="absolute inset-0 -z-10 bg-grid-violet" aria-hidden="true" />
      <div
        className="absolute -left-40 -top-40 -z-10 h-[34rem] w-[34rem] rounded-full bg-vio-600/40 blur-[120px] animate-float-slow"
        aria-hidden="true"
      />
      <div
        className="absolute -right-32 top-10 -z-10 h-[30rem] w-[30rem] rounded-full bg-neon-magenta/25 blur-[120px] animate-float-slow [animation-delay:-5s]"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-10rem] left-1/3 -z-10 h-[26rem] w-[26rem] rounded-full bg-neon-cyan/15 blur-[120px] animate-float-slow [animation-delay:-9s]"
        aria-hidden="true"
      />

      <div className="content-container grid min-h-[78vh] items-center gap-12 py-20 small:grid-cols-[1.15fr_0.85fr]">
        <div className="animate-rise-in">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-ui-border-strong bg-ui-bg-base/60 px-4 py-1.5 text-sm text-ui-fg-subtle">
            <span className="h-2 w-2 rounded-full bg-neon-lime shadow-[0_0_10px_#a3ff12] animate-glow-pulse" />
            Despacho directo a todo Chile
          </p>
          <h1 className="font-display text-5xl font-bold uppercase leading-[0.98] tracking-tight small:text-7xl">
            Sube de nivel <span className="text-rgb">tu setup</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-ui-fg-subtle">
            Tarjetas de video, procesadores, periféricos, redes y seguridad.
            Hardware de las mejores marcas, con envío en 2-4 días hábiles en Santiago.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <LocalizedClientLink
              href="/store"
              className="rounded-md bg-vio-600 px-7 py-3.5 font-display text-base font-semibold uppercase tracking-wider text-white shadow-[0_0_28px_-4px_rgba(168,85,247,0.8)] transition-all hover:bg-vio-500 hover:shadow-[0_0_40px_-2px_rgba(255,43,214,0.7)]"
            >
              Ver la tienda
            </LocalizedClientLink>
            <LocalizedClientLink
              href="/categories/gaming"
              className="rounded-md border border-ui-border-strong px-7 py-3.5 font-display text-base font-semibold uppercase tracking-wider text-ui-fg-base transition-colors hover:border-neon-cyan hover:text-neon-cyan"
            >
              Zona Gaming
            </LocalizedClientLink>
          </div>
        </div>

        <div className="relative hidden small:block" aria-hidden="true">
          <div className="rgb-border relative aspect-[4/5] rounded-2xl bg-ui-bg-base/70 p-6 backdrop-blur">
            <div className="flex h-full flex-col justify-between">
              <div className="flex items-center justify-between font-display text-sm uppercase tracking-widest text-ui-fg-muted">
                <span>GPU · Alto rendimiento</span>
                <span className="text-neon-lime">En stock</span>
              </div>
              <svg viewBox="0 0 320 220" className="w-full drop-shadow-[0_0_24px_rgba(168,85,247,0.55)]">
                <defs>
                  <linearGradient id="hero-card" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#22d3ee" />
                    <stop offset="0.55" stopColor="#a855f7" />
                    <stop offset="1" stopColor="#ff2bd6" />
                  </linearGradient>
                </defs>
                <rect x="14" y="52" width="292" height="118" rx="12" fill="#150d2e" stroke="url(#hero-card)" strokeWidth="2.5" />
                <rect x="30" y="70" width="108" height="82" rx="8" fill="none" stroke="url(#hero-card)" strokeWidth="2" />
                <circle cx="84" cy="111" r="30" fill="none" stroke="url(#hero-card)" strokeWidth="2.5" />
                <circle cx="84" cy="111" r="9" fill="url(#hero-card)" />
                <rect x="152" y="70" width="108" height="82" rx="8" fill="none" stroke="url(#hero-card)" strokeWidth="2" />
                <circle cx="206" cy="111" r="30" fill="none" stroke="url(#hero-card)" strokeWidth="2.5" />
                <circle cx="206" cy="111" r="9" fill="url(#hero-card)" />
                <rect x="274" y="76" width="18" height="70" rx="4" fill="url(#hero-card)" opacity="0.85" />
                <rect x="40" y="170" width="150" height="16" rx="3" fill="#a855f7" opacity="0.7" />
              </svg>
              <div>
                <p className="font-display text-2xl font-semibold uppercase">Rendimiento sin límites</p>
                <p className="mt-1 text-sm text-ui-fg-subtle">Las últimas generaciones, listas para despachar.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero
