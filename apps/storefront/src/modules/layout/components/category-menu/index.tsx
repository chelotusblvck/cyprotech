import type { NavCategory } from "@lib/data/categories"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const LINK =
  "relative py-2 text-ui-fg-subtle transition-colors hover:text-ui-fg-base after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-neon-magenta after:shadow-[0_0_8px_#ff2bd6] after:transition-transform hover:after:scale-x-100"

// Menú de categorías del navbar (escritorio). El desplegable se abre con el mouse o con el foco del
// teclado, solo con CSS: no necesita JavaScript. En pantallas táctiles el toque lleva a la categoría.
export default function CategoryMenu({ categories }: { categories: NavCategory[] }) {
  return (
    <>
      {categories.map((category) => {
        const hasChildren = category.children.length > 0
        // Con muchas subcategorías el panel pasa a dos columnas.
        const wide = category.children.length > 6
        return (
          <li key={category.handle} className="group/cat relative">
            <LocalizedClientLink
              href={`/categories/${category.handle}`}
              className={`${LINK} inline-flex items-center gap-1.5`}
              aria-haspopup={hasChildren ? "true" : undefined}
            >
              {category.name}
              {hasChildren && (
                <svg
                  className="h-3 w-3 transition-transform duration-200 group-hover/cat:rotate-180 group-focus-within/cat:rotate-180"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2.5 4.5 6 8l3.5-3.5" />
                </svg>
              )}
            </LocalizedClientLink>

            {hasChildren && (
              // El relleno superior (pt-3) une el enlace con el panel para que no se cierre al bajar el mouse.
              <div
                className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 translate-y-1 pt-3 opacity-0 transition-all duration-150 group-hover/cat:visible group-hover/cat:translate-y-0 group-hover/cat:opacity-100 group-focus-within/cat:visible group-focus-within/cat:translate-y-0 group-focus-within/cat:opacity-100"
                data-testid={`nav-dropdown-${category.handle}`}
              >
                <div
                  className={`rounded-large border border-ui-border-base bg-ui-bg-base p-3 font-sans text-sm normal-case tracking-normal shadow-[0_18px_50px_-12px_rgba(124,58,237,0.45)] ${
                    wide ? "w-[460px]" : "w-[250px]"
                  }`}
                >
                  <LocalizedClientLink
                    href="/store"
                    aria-label="Ver todos los productos de la tienda"
                    className="mb-2 flex items-center justify-between rounded-rounded px-3 py-2 font-display text-[13px] font-semibold uppercase tracking-wider text-ui-fg-interactive transition-colors hover:bg-ui-bg-base-hover"
                  >
                    Ver toda la tienda
                    <span aria-hidden="true">→</span>
                  </LocalizedClientLink>
                  <ul className={`grid gap-x-2 ${wide ? "grid-cols-2" : "grid-cols-1"}`}>
                    {category.children.map((child) => (
                      <li key={child.handle}>
                        <LocalizedClientLink
                          href={`/categories/${child.handle}`}
                          className="block rounded-rounded px-3 py-2 text-ui-fg-subtle transition-colors hover:bg-ui-bg-base-hover hover:text-ui-fg-base"
                        >
                          {child.name}
                        </LocalizedClientLink>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </li>
        )
      })}
    </>
  )
}
