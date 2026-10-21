"use client"

const STORAGE_KEY = "cy-theme"

// Los iconos se alternan con CSS (`dark:`), así el botón no depende del estado de React ni parpadea
// al hidratar. El tema inicial lo fija un script en el <head> (ver app/layout.tsx).
export default function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement
    const next = root.classList.contains("dark") ? "light" : "dark"
    root.classList.remove("dark", "light")
    root.classList.add(next)
    root.dataset.mode = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Sin almacenamiento (modo privado): el cambio vale solo para esta visita.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Cambiar entre tema claro y oscuro"
      title="Cambiar tema"
      data-testid="theme-toggle"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ui-border-base text-ui-fg-subtle transition-colors hover:border-ui-border-interactive hover:text-ui-fg-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vio-400"
    >
      {/* Sol: se ve en tema oscuro (lleva al claro). */}
      <svg className="hidden dark:block" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      {/* Luna: se ve en tema claro (lleva al oscuro). */}
      <svg className="block dark:hidden" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  )
}
