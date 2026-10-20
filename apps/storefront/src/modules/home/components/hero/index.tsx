"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { HERO_SLIDES } from "@lib/hero-slides"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const INTERVAL_MS = 6000

const Hero = () => {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const touchStart = useRef<number | null>(null)
  const total = HERO_SLIDES.length

  const go = useCallback((next: number) => setIndex((next + total) % total), [total])

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduceMotion(query.matches)
    const onChange = () => setReduceMotion(query.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    if (paused || reduceMotion) {
      return
    }
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % total), INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [paused, reduceMotion, total, index])

  const arrow =
    "absolute top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-vio-950/50 text-xl text-white backdrop-blur-sm transition-colors hover:border-neon-magenta small:flex"

  return (
    <section
      className="relative isolate overflow-hidden border-b border-ui-border-base"
      aria-roledescription="carrusel"
      aria-label="Destacados"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => {
        touchStart.current = e.touches[0].clientX
      }}
      onTouchEnd={(e) => {
        if (touchStart.current === null) {
          return
        }
        const delta = e.changedTouches[0].clientX - touchStart.current
        touchStart.current = null
        if (Math.abs(delta) > 50) {
          go(index + (delta < 0 ? 1 : -1))
        }
      }}
    >
      <div className="relative min-h-[620px] small:min-h-[78vh]">
        {HERO_SLIDES.map((slide, i) => {
          const active = i === index
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-700 ${active ? "z-10 opacity-100" : "pointer-events-none opacity-0"}`}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${total}`}
              aria-hidden={!active}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.image}
                alt=""
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                className={`absolute inset-0 h-full w-full object-cover transition-transform [transition-duration:7000ms] ease-out ${active && !reduceMotion ? "scale-105" : "scale-100"}`}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-vio-950 via-vio-950/75 to-vio-950/10 small:via-vio-950/55" aria-hidden="true" />
              <div className="absolute inset-0 bg-gradient-to-t from-vio-950/80 via-transparent to-transparent" aria-hidden="true" />

              <div className="content-container relative flex h-full min-h-[620px] items-center py-20 small:min-h-[78vh]">
                <div className={`max-w-2xl ${active ? "animate-rise-in" : ""}`}>
                  <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-vio-950/60 px-4 py-1.5 text-sm text-white/85 backdrop-blur-sm">
                    <span className="h-2 w-2 rounded-full bg-neon-lime shadow-[0_0_10px_#a3ff12] animate-glow-pulse" />
                    {slide.kicker}
                  </p>
                  {i === 0 ? (
                    <h1 className="font-display text-5xl font-bold uppercase leading-[0.98] tracking-tight text-white small:text-7xl">
                      {slide.title} <span className="text-rgb">{slide.highlight}</span>
                    </h1>
                  ) : (
                    <h2 className="font-display text-5xl font-bold uppercase leading-[0.98] tracking-tight text-white small:text-7xl">
                      {slide.title} {slide.highlight ? <span className="text-rgb">{slide.highlight}</span> : null}
                    </h2>
                  )}
                  <p className="mt-6 max-w-xl text-lg leading-8 text-white/80">{slide.text}</p>
                  <div className="mt-9 flex flex-wrap items-center gap-4">
                    <LocalizedClientLink
                      href={slide.cta.href}
                      tabIndex={active ? 0 : -1}
                      className="rounded-md bg-vio-600 px-7 py-3.5 font-display text-base font-semibold uppercase tracking-wider text-white shadow-[0_0_28px_-4px_rgba(168,85,247,0.8)] transition-all hover:bg-vio-500 hover:shadow-[0_0_40px_-2px_rgba(255,43,214,0.7)]"
                    >
                      {slide.cta.label}
                    </LocalizedClientLink>
                    {slide.secondary ? (
                      <LocalizedClientLink
                        href={slide.secondary.href}
                        tabIndex={active ? 0 : -1}
                        className="rounded-md border border-white/40 px-7 py-3.5 font-display text-base font-semibold uppercase tracking-wider text-white transition-colors hover:border-neon-cyan hover:text-neon-cyan"
                      >
                        {slide.secondary.label}
                      </LocalizedClientLink>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        <button type="button" className={`${arrow} left-4`} onClick={() => go(index - 1)} aria-label="Diapositiva anterior">
          &larr;
        </button>
        <button type="button" className={`${arrow} right-4`} onClick={() => go(index + 1)} aria-label="Diapositiva siguiente">
          &rarr;
        </button>

        <div className="absolute inset-x-0 bottom-20 z-20 flex items-center justify-center gap-2.5">
          {HERO_SLIDES.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Ir a la diapositiva ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              className={`h-2.5 rounded-full transition-all ${i === index ? "w-9 bg-neon-magenta shadow-[0_0_10px_#ff2bd6]" : "w-2.5 bg-white/40 hover:bg-white/70"}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export default Hero
