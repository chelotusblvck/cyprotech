import { Suspense } from "react"

import { listLocales } from "@lib/data/locales"
import { getLocale } from "@lib/data/locale-actions"
import { listRegions } from "@lib/data/regions"
import { MAIN_CATEGORIES } from "@lib/brand"
import { listNavCategories } from "@lib/data/categories"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CategoryMenu from "@modules/layout/components/category-menu"
import CartButton from "@modules/layout/components/cart-button"
import Logo from "@modules/layout/components/logo"
import Search from "@modules/layout/components/search"
import SideMenu from "@modules/layout/components/side-menu"
import ThemeToggle from "@modules/layout/components/theme-toggle"

export default async function Nav() {
  const [regions, locales, currentLocale, categories] = await Promise.all([
    listRegions().then((regions: StoreRegion[]) => regions),
    listLocales(),
    getLocale(),
    listNavCategories(MAIN_CATEGORIES),
  ])

  return (
    <div className="sticky top-0 inset-x-0 z-50 group">
      <div className="h-[2px] w-full bg-[image:var(--cy-rgb)] bg-[length:200%_100%] animate-rgb-shift" />
      <header className="relative h-16 mx-auto border-b border-ui-border-base glass-bar">
        <nav className="content-container flex items-center justify-between w-full h-full text-small-regular text-ui-fg-subtle">
          <div className="flex items-center gap-x-4 flex-1 basis-0 h-full">
            <div className="h-full small:hidden">
              <SideMenu regions={regions} locales={locales} currentLocale={currentLocale} categories={categories} />
            </div>
            <Logo />
          </div>

          <ul className="hidden small:flex items-center gap-x-8 font-display text-[15px] font-medium uppercase tracking-wider">
            <CategoryMenu categories={categories} />
            <li>
              <LocalizedClientLink
                href="/novedades"
                className="relative py-2 text-ui-fg-subtle transition-colors hover:text-ui-fg-base after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-neon-magenta after:shadow-[0_0_8px_#ff2bd6] after:transition-transform hover:after:scale-x-100"
              >
                Novedades
              </LocalizedClientLink>
            </li>
          </ul>

          <div className="flex items-center gap-x-6 h-full flex-1 basis-0 justify-end">
            <Search />
            <div className="hidden small:flex items-center gap-x-6 h-full">
              <LocalizedClientLink
                className="hover:text-ui-fg-base transition-colors"
                href="/account"
                data-testid="nav-account-link"
              >
                Mi cuenta
              </LocalizedClientLink>
            </div>
            <Suspense
              fallback={
                <LocalizedClientLink
                  className="hover:text-ui-fg-base flex gap-2"
                  href="/cart"
                  data-testid="nav-cart-link"
                >
                  Carrito (0)
                </LocalizedClientLink>
              }
            >
              <CartButton />
            </Suspense>
            <ThemeToggle />
          </div>
        </nav>
      </header>
    </div>
  )
}
