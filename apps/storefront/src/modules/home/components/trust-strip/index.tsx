const ITEMS = [
  {
    title: "Despacho Santiago",
    text: "2-4 días hábiles",
    icon: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01",
  },
  {
    title: "Despacho regiones",
    text: "4-6 días hábiles",
    icon: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  },
  {
    title: "Garantía oficial",
    text: "Respaldo de cada marca",
    icon: "M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6zM9 12l2 2 4-4",
  },
  {
    title: "Pago seguro",
    text: "Tarjetas y transferencia",
    icon: "M4 6h16v12H4zM4 10h16M7 15h3",
  },
]

export default function TrustStrip() {
  return (
    <section className="content-container -mt-8 relative z-10">
      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ui-border-base bg-ui-border-base small:grid-cols-4">
        {ITEMS.map((item) => (
          <li key={item.title} className="flex items-center gap-4 bg-ui-bg-base px-5 py-5">
            <svg
              viewBox="0 0 24 24"
              className="h-7 w-7 shrink-0 text-neon-cyan drop-shadow-[0_0_6px_rgba(34,211,238,0.7)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={item.icon} />
            </svg>
            <div>
              <p className="font-display text-[15px] font-semibold uppercase tracking-wide text-ui-fg-base">
                {item.title}
              </p>
              <p className="text-sm text-ui-fg-subtle">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
