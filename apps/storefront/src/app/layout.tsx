import { getBaseURL } from "@lib/util/env"
import { BRAND } from "@lib/brand"
import { Metadata } from "next"
import { Chakra_Petch, Inter } from "next/font/google"
import "styles/globals.css"

const display = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
})

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: {
    default: `${BRAND.name} | ${BRAND.tagline}`,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.description,
}

// Se ejecuta antes de pintar: si la persona eligió el tema claro, evita el destello del oscuro.
const THEME_SCRIPT = `try{if(localStorage.getItem("cy-theme")==="light"){var r=document.documentElement;r.classList.remove("dark");r.classList.add("light");r.dataset.mode="light"}}catch(e){}`

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`dark ${display.variable} ${body.variable}`} data-mode="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-ui-bg-subtle text-ui-fg-base">
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
