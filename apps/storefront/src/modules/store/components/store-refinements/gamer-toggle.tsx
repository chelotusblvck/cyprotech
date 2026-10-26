"use client"

import { useToggleRefinement } from "react-instantsearch"

import { GAMER_LABEL, LABELS_ATTRIBUTE } from "./attributes"

/** Deja solo los productos con la etiqueta gamer. Se oculta si no hay ninguno. */
const GamerToggle = () => {
  const { value, refine, canRefine } = useToggleRefinement({
    attribute: LABELS_ATTRIBUTE,
    on: GAMER_LABEL,
  })

  if (!canRefine && !value.isRefined) {
    return null
  }

  return (
    <label className="flex cursor-pointer items-center gap-x-2">
      <input
        type="checkbox"
        checked={value.isRefined}
        onChange={() => refine(value)}
        className="shrink-0 accent-ui-fg-interactive"
        data-testid="gamer-toggle"
      />
      <span className="txt-compact-small-plus text-ui-fg-subtle">Solo gaming</span>
      {typeof value.count === "number" && (
        <span className="text-small-regular text-ui-fg-muted">({value.count})</span>
      )}
    </label>
  )
}

export default GamerToggle
