"use client"

import { useState } from "react"
import { useSortBy } from "react-instantsearch"

import FilterRadioGroup from "@modules/common/components/filter-radio-group"
import {
  CATEGORY_ATTRIBUTE,
  LABELS_ATTRIBUTE,
  getSortOptions,
} from "./attributes"
import CurrentRefinements from "./current-refinements"
import OnSaleToggle from "./on-sale-toggle"
import OptionRefinements from "./option-refinements"
import PriceRange from "./price-range"
import RefinementGroup from "./refinement-group"

const SortProducts = ({ currencyCode }: { currencyCode: string }) => {
  const items = getSortOptions(currencyCode)
  const { currentRefinement, refine } = useSortBy({ items })

  return (
    <FilterRadioGroup
      title="Ordenar por"
      items={items}
      value={currentRefinement}
      handleChange={refine}
      data-testid="sort-by-container"
    />
  )
}

// En movil los filtros quedan tras un boton para que los productos aparezcan en la primera pantalla.
const StoreRefinements = ({ currencyCode }: { currencyCode: string }) => {
  const [open, setOpen] = useState(false)

  return (
    <div className="small:w-[250px] small:shrink-0 small:ml-[1.675rem]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="store-filters"
        className="mb-4 flex w-full items-center justify-between rounded-rounded border border-ui-border-base px-4 py-3 text-sm font-semibold text-ui-fg-base small:hidden"
        data-testid="toggle-filters"
      >
        Filtrar y ordenar
        <span aria-hidden="true">{open ? "-" : "+"}</span>
      </button>
      <div
        id="store-filters"
        className={`${open ? "flex" : "hidden"} flex-col gap-12 py-4 mb-8 pl-6 small:flex small:px-0`}
      >
        <SortProducts currencyCode={currencyCode} />
        <CurrentRefinements currencyCode={currencyCode} />
        <OptionRefinements />
        <PriceRange currencyCode={currencyCode} />
        <OnSaleToggle currencyCode={currencyCode} />
        <RefinementGroup attribute={CATEGORY_ATTRIBUTE} title="Categoría" />
        <RefinementGroup attribute={LABELS_ATTRIBUTE} title="Etiquetas" />
      </div>
    </div>
  )
}

export default StoreRefinements
