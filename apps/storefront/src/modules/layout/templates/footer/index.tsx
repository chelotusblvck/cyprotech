import { listCategories } from "@lib/data/categories"
import { BRAND } from "@lib/brand"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Logo from "@modules/layout/components/logo"

const linkClass = "hover:text-neon-magenta transition-colors"

export default async function Footer() {
  const productCategories = await listCategories()

  return (
    <footer className="relative w-full border-t border-ui-border-base mt-24">
      <div className="h-[2px] w-full bg-[image:var(--cy-rgb)] bg-[length:200%_100%] animate-rgb-shift" />
      <div className="content-container flex flex-col w-full">
        <div className="flex flex-col gap-y-12 small:flex-row items-start justify-between py-16 small:py-20">
          <div className="max-w-sm flex flex-col gap-y-4">
            <Logo />
            <p className="text-ui-fg-subtle txt-small leading-6">
              {BRAND.description}
            </p>
          </div>

          <div className="text-small-regular gap-10 md:gap-x-16 grid grid-cols-2 sm:grid-cols-3">
            {productCategories && productCategories.length > 0 && (
              <div className="flex flex-col gap-y-3">
                <span className="font-display uppercase tracking-wider text-ui-fg-base">
                  Categorías
                </span>
                <ul className="grid grid-cols-1 gap-2" data-testid="footer-categories">
                  {productCategories
                    .filter((c) => !c.parent_category)
                    .slice(0, 6)
                    .map((c) => (
                      <li key={c.id} className="text-ui-fg-subtle txt-small">
                        <LocalizedClientLink
                          className={linkClass}
                          href={`/categories/${c.handle}`}
                          data-testid="category-link"
                        >
                          {c.name}
                        </LocalizedClientLink>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-y-3">
              <span className="font-display uppercase tracking-wider text-ui-fg-base">
                Despacho
              </span>
              <ul className="grid grid-cols-1 gap-2 text-ui-fg-subtle txt-small">
                <li>Santiago: 2-4 días hábiles</li>
                <li>Regiones: 4-6 días hábiles</li>
                <li>Directo a tu domicilio</li>
              </ul>
            </div>

            <div className="flex flex-col gap-y-3">
              <span className="font-display uppercase tracking-wider text-ui-fg-base">
                Tu cuenta
              </span>
              <ul className="grid grid-cols-1 gap-2 text-ui-fg-subtle txt-small">
                <li>
                  <LocalizedClientLink className={linkClass} href="/account">
                    Ingresar o registrarme
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink className={linkClass} href="/account/orders">
                    Mis pedidos
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink className={linkClass} href="/cart">
                    Carrito
                  </LocalizedClientLink>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 small:flex-row w-full py-8 justify-between border-t border-ui-border-base txt-compact-small text-ui-fg-muted">
          <span>
            © {new Date().getFullYear()} {BRAND.legalName}. Todos los derechos reservados. Los nombres de juegos y marcas pertenecen a sus propietarios.
          </span>
          <span>
            Plataforma desarrollada por{" "}
            <a
              href={BRAND.developer.url}
              target="_blank"
              rel="noopener"
              className="text-ui-fg-interactive hover:text-neon-magenta transition-colors underline-offset-4 hover:underline"
            >
              {BRAND.developer.name}
            </a>
          </span>
        </div>
      </div>
    </footer>
  )
}
