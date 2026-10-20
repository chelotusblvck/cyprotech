import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ChevronDown from "@modules/common/icons/chevron-down"
import Logo from "@modules/layout/components/logo"
import { BRAND } from "@lib/brand"

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-full bg-ui-bg-base relative small:min-h-screen">
      <div className="h-16 bg-ui-bg-base border-b border-ui-border-base">
        <nav className="flex h-full items-center content-container justify-between">
          <LocalizedClientLink
            href="/cart"
            className="text-small-semi text-ui-fg-base flex items-center gap-x-2 uppercase flex-1 basis-0"
            data-testid="back-to-cart-link"
          >
            <ChevronDown className="rotate-90" size={16} />
            <span className="mt-px hidden small:block txt-compact-plus text-ui-fg-subtle hover:text-ui-fg-base ">
              Volver al carrito
            </span>
            <span className="mt-px block small:hidden txt-compact-plus text-ui-fg-subtle hover:text-ui-fg-base">
              Volver
            </span>
          </LocalizedClientLink>
          <Logo />
          <div className="flex-1 basis-0" />
        </nav>
      </div>
      <div className="relative" data-testid="checkout-container">{children}</div>
      <div className="py-4 w-full flex items-center justify-center txt-compact-small text-ui-fg-muted">
        <span>
          Plataforma desarrollada por{" "}
          <a
            href={BRAND.developer.url}
            target="_blank"
            rel="noopener"
            className="text-ui-fg-interactive hover:text-neon-magenta transition-colors"
          >
            {BRAND.developer.name}
          </a>
        </span>
      </div>
    </div>
  )
}
