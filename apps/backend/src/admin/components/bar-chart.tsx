import { Text } from "@medusajs/ui"
import { useState } from "react"

export type Bar = { key: string; label: string; value: number; detail?: string }

// Barras de una sola serie: un solo color, extremo superior redondeado de 4px, 2px entre barras y
// base anclada en cero. El tooltip sigue a la barra; la etiqueta directa marca solo el máximo.
// Para lectores de pantalla se resume en aria-label y la página ofrece la misma data en tabla.
export const BarChart = ({
  bars,
  format,
  height = 168,
  ariaLabel,
}: {
  bars: Bar[]
  format: (value: number) => string
  height?: number
  ariaLabel: string
}) => {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...bars.map((bar) => bar.value), 0)
  const maxIndex = bars.findIndex((bar) => bar.value === max && max > 0)
  const active = hover === null ? null : bars[hover]

  if (bars.length === 0 || max === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-ui-bg-subtle" style={{ height }}>
        <Text size="small" className="text-ui-fg-muted">
          Sin ventas en este período.
        </Text>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="h-5" />

      <div
        role="img"
        aria-label={ariaLabel}
        className="relative flex items-end gap-[2px] border-b border-ui-border-base"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Líneas de guía recesivas a 50% y 100% */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-ui-border-base opacity-60" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-ui-border-base opacity-40" />

        {bars.map((bar, index) => {
          const pct = (bar.value / max) * 100
          const isHot = hover === index
          return (
            <div
              key={bar.key}
              className="relative flex h-full flex-1 items-end"
              onMouseEnter={() => setHover(index)}
              onFocus={() => setHover(index)}
              tabIndex={0}
              aria-label={`${bar.label}: ${format(bar.value)}`}
            >
              <div
                className="w-full transition-opacity"
                style={{
                  height: `${Math.max(pct, bar.value > 0 ? 2 : 0)}%`,
                  background: "var(--bg-interactive)",
                  opacity: hover === null || isHot ? 1 : 0.45,
                  borderRadius: "4px 4px 0 0",
                }}
              />
              {index === maxIndex && hover === null ? (
                <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums text-ui-fg-subtle">
                  {format(bar.value)}
                </span>
              ) : null}
            </div>
          )
        })}

        {active ? (
          <div
            className="pointer-events-none absolute z-10 rounded-md bg-ui-bg-base px-2.5 py-1.5 text-xs shadow-elevation-flyout"
            style={{
              left: `${((hover as number) + 0.5) * (100 / bars.length)}%`,
              top: 0,
              transform: `translate(${(hover as number) > bars.length * 0.7 ? "-100%" : "0"}, 0)`,
            }}
          >
            <div className="font-medium text-ui-fg-base">{active.label}</div>
            <div className="tabular-nums text-ui-fg-subtle">{format(active.value)}</div>
            {active.detail ? <div className="text-ui-fg-muted">{active.detail}</div> : null}
          </div>
        ) : null}
      </div>

      <div className="flex justify-between pt-1.5">
        <Text size="xsmall" className="text-ui-fg-muted">
          {bars[0].label}
        </Text>
        <Text size="xsmall" className="text-ui-fg-muted">
          {bars[Math.floor(bars.length / 2)].label}
        </Text>
        <Text size="xsmall" className="text-ui-fg-muted">
          {bars[bars.length - 1].label}
        </Text>
      </div>
    </div>
  )
}
