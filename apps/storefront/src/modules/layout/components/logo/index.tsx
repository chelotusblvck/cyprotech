import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <LocalizedClientLink
      href="/"
      aria-label="Cyprotech, inicio"
      className={`group inline-flex items-center gap-2.5 ${className}`}
      data-testid="nav-store-link"
    >
      <svg
        viewBox="0 0 32 32"
        className="h-7 w-7 small:h-8 small:w-8 shrink-0 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)] transition-transform duration-300 group-hover:rotate-[30deg]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="cy-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="0.5" stopColor="#a855f7" />
            <stop offset="1" stopColor="#ff2bd6" />
          </linearGradient>
        </defs>
        <path
          d="M16 2 28 9v14L16 30 4 23V9z"
          fill="none"
          stroke="url(#cy-logo)"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path
          d="M21 12.2a6 6 0 1 0 0 7.6"
          fill="none"
          stroke="url(#cy-logo)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-display text-lg small:text-xl font-bold uppercase tracking-[0.1em] small:tracking-[0.14em] text-ui-fg-base">
        Cypro<span className="text-rgb">tech</span>
      </span>
    </LocalizedClientLink>
  )
}
