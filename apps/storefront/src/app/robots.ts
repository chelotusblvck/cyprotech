import type { MetadataRoute } from "next"

import { getBaseURL } from "@lib/util/env"

export default function robots(): MetadataRoute.Robots {
  const base = getBaseURL()

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Rutas privadas o sin valor para buscadores.
        disallow: ["/*/checkout", "/*/cart", "/*/account", "/*/order", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
