"use client"

import { MagnifyingGlass } from "@medusajs/icons"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import type { SearchClient } from "instantsearch.js"
import {
  Configure,
  InstantSearch,
  useHits,
  useInstantSearch,
  useSearchBox,
} from "react-instantsearch"

import useSearchSettled from "@lib/hooks/use-search-settled"
import useToggleState from "@lib/hooks/use-toggle-state"
import { PRODUCT_INDEX_NAME, searchClient } from "@lib/search-client"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import HitPrice from "@modules/store/components/store-hits/price"
import { Text } from "@modules/common/components/ui"
import SearchDrawer from "./drawer"
import SearchHit, { ProductHit } from "./hit"

const HITS_PER_PAGE = 12
const DEBOUNCE_MS = 250

const SearchPanel = ({ onNavigate }: { onNavigate: () => void }) => {
  const timer = useRef<number | undefined>(undefined)

  const queryHook = useCallback(
    (nextQuery: string, search: (value: string) => void) => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => search(nextQuery), DEBOUNCE_MS)
    },
    []
  )

  const { query, refine } = useSearchBox({ queryHook })
  const { items } = useHits<ProductHit>()
  const { status, error } = useInstantSearch()
  const { isSettled } = useSearchSettled()

  const [inputValue, setInputValue] = useState(query)
  const [preview, setPreview] = useState<ProductHit | null>(null)
  const router = useRouter()
  const { countryCode } = useParams<{ countryCode: string }>()

  const resultsHref = `/store?product%5Bquery%5D=${encodeURIComponent(query.trim())}`

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const hasInput = Boolean(inputValue.trim())
  const isPending = inputValue.trim() !== query.trim()
  const hasResults = Boolean(query.trim()) && items.length > 0

  return (
    <>
      <form
        className="flex items-center gap-x-3 border-b border-ui-border-base px-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!inputValue.trim()) {
            return
          }
          onNavigate()
          router.push(
            `/${countryCode}/store?product%5Bquery%5D=${encodeURIComponent(inputValue.trim())}`
          )
        }}
      >
        <MagnifyingGlass className="shrink-0 text-ui-fg-muted" />
        <input
          type="search"
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value)
            refine(event.target.value)
          }}
          placeholder="Buscar productos"
          aria-label="Buscar productos"
          autoFocus
          className="txt-medium w-full bg-transparent py-4 text-ui-fg-base outline-none placeholder:text-ui-fg-muted"
          data-testid="search-input"
        />
      </form>

      <div className="flex-1 overflow-y-auto">
        {!hasInput ? (
          <Text
            className="px-4 py-6 text-center text-ui-fg-muted"
            data-testid="search-empty"
          >
            Escribe para buscar productos.
          </Text>
        ) : status === "error" ? (
          <Text
            className="px-4 py-6 text-center text-ui-fg-error"
            data-testid="search-error"
          >
            No pudimos buscar productos
            {error?.message ? `: ${error.message}` : "."}
          </Text>
        ) : !isSettled ? (
          <Text
            className="px-4 py-6 text-center text-ui-fg-muted"
            data-testid="search-loading"
          >
            Buscando&hellip;
          </Text>
        ) : hasResults ? (
          <ul className="py-2" data-testid="search-results">
            {items.map((hit) => (
              <SearchHit
                key={hit.objectID}
                hit={hit}
                onNavigate={onNavigate}
                onPreview={setPreview}
              />
            ))}
            <li className="px-4 pt-2">
              <LocalizedClientLink
                href={resultsHref}
                onClick={onNavigate}
                className="block rounded-rounded border border-ui-border-base py-2 text-center text-sm font-semibold text-ui-fg-interactive hover:bg-ui-bg-base-hover"
                data-testid="search-view-all"
              >
                Ver todos los resultados
              </LocalizedClientLink>
            </li>
          </ul>
        ) : isPending || !query.trim() ? (
          <Text
            className="px-4 py-6 text-center text-ui-fg-muted"
            data-testid="search-loading"
          >
            Buscando&hellip;
          </Text>
        ) : (
          <Text
            className="px-4 py-6 text-center text-ui-fg-subtle"
            data-testid="search-no-results"
          >
            No encontramos productos para &quot;{query}&quot;
          </Text>
        )}
      </div>

      {preview && hasResults && (
        <div
          className="pointer-events-none absolute right-full top-16 mr-3 hidden w-72 overflow-hidden rounded-rounded border border-ui-border-base bg-ui-bg-base shadow-elevation-modal md:block"
          data-testid="search-preview"
        >
          <div className="relative aspect-square bg-white">
            {preview.thumbnail && (
              <Image
                src={preview.thumbnail}
                alt=""
                fill
                sizes="288px"
                className="object-contain p-3"
                draggable={false}
              />
            )}
          </div>
          <div className="flex flex-col gap-y-1 p-4">
            <Text className="txt-medium text-ui-fg-base line-clamp-3">
              {preview.title}
            </Text>
            <HitPrice hit={preview} currencyCode="clp" />
          </div>
        </div>
      )}
    </>
  )
}

const Search = () => {
  const { state: isOpen, open, close } = useToggleState()

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Buscar productos"
        className="flex items-center hover:text-ui-fg-base"
        data-testid="nav-search-button"
      >
        <MagnifyingGlass />
      </button>

      <SearchDrawer isOpen={isOpen} close={close}>
        <InstantSearch
          indexName={PRODUCT_INDEX_NAME}
          searchClient={searchClient as unknown as SearchClient}
          future={{ preserveSharedStateOnUnmount: true }}
        >
          <Configure hitsPerPage={HITS_PER_PAGE} />
          <SearchPanel onNavigate={close} />
        </InstantSearch>
      </SearchDrawer>
    </>
  )
}

export default Search
