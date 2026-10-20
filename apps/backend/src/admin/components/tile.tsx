import { Text } from "@medusajs/ui"
import type { ReactNode } from "react"

// Una cifra grande con su rótulo. Para un indicador suelto un número dice más que un gráfico.
export const Tile = ({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: "default" | "negative"
}) => (
  <div className="flex flex-col gap-y-1 rounded-lg bg-ui-bg-subtle px-4 py-3">
    <Text size="small" className="text-ui-fg-subtle">
      {label}
    </Text>
    <span
      className={`text-2xl font-semibold tabular-nums ${tone === "negative" ? "text-ui-fg-error" : "text-ui-fg-base"}`}
    >
      {value}
    </span>
    {hint ? (
      <Text size="xsmall" className="text-ui-fg-muted">
        {hint}
      </Text>
    ) : null}
  </div>
)

export const TileGrid = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{children}</div>
)
