import { decodeBody, feedsFromEnv, guessCategory, guessGame, importFeeds } from "../import"
import { normalizeNews, slugify, uniqueSlug } from "../logic"
import { parseFeed, toExcerpt } from "../rss"

describe("slugify y uniqueSlug", () => {
  it("quita tildes, signos y espacios", () => {
    expect(slugify("¡Lanzamiento: nueva expansión de Overwatch!")).toBe("lanzamiento-nueva-expansion-de-overwatch")
  })

  it("agrega un número si el slug ya existe", () => {
    expect(uniqueSlug("Hola mundo", new Set(["hola-mundo"]))).toBe("hola-mundo-2")
    expect(uniqueSlug("Hola mundo", new Set(["hola-mundo", "hola-mundo-2"]))).toBe("hola-mundo-3")
    expect(uniqueSlug("!!!", new Set())).toBe("nota")
  })
})

describe("normalizeNews", () => {
  const base = { title: "  Título  ", summary: "Resumen corto." }

  it("recorta los textos y vacía los opcionales en blanco", () => {
    expect(normalizeNews({ ...base, body: "   ", source_name: " Riot " })).toMatchObject({
      title: "Título",
      body: null,
      source_name: "Riot",
    })
  })

  it("exige título y resumen al crear", () => {
    expect(() => normalizeNews({ summary: "x" })).toThrow(/título/)
    expect(() => normalizeNews({ title: "x" })).toThrow(/resumen/)
  })

  it("en una edición parcial solo valida lo que llega", () => {
    expect(normalizeNews({ featured: true }, true)).toEqual({ featured: true })
    expect(() => normalizeNews({ title: " " }, true)).toThrow(/título/)
  })

  it("rechaza categorías, estados y enlaces inválidos", () => {
    expect(() => normalizeNews({ ...base, category: "memes" })).toThrow(/Categoría/)
    expect(() => normalizeNews({ ...base, status: "archivada" })).toThrow(/Estado/)
    expect(() => normalizeNews({ ...base, source_url: "javascript:alert(1)" })).toThrow(/URL/)
    expect(() => normalizeNews({ ...base, image_url: "data:text/html,x" })).toThrow(/imagen/)
  })

  it("acepta imágenes como ruta de la tienda o URL completa", () => {
    expect(normalizeNews({ ...base, image_url: "/novedades/x.svg" }).image_url).toBe("/novedades/x.svg")
    expect(normalizeNews({ ...base, image_url: "https://cdn.x.cl/a.jpg" }).image_url).toBe("https://cdn.x.cl/a.jpg")
  })

  it("convierte la fecha de publicación y rechaza una inválida", () => {
    expect(normalizeNews({ ...base, published_at: "2026-10-20T12:00:00Z" }).published_at).toEqual(new Date("2026-10-20T12:00:00Z"))
    expect(normalizeNews({ ...base, published_at: null }).published_at).toBeNull()
    expect(() => normalizeNews({ ...base, published_at: "mañana" })).toThrow(/fecha/)
  })

  it("limita el largo del resumen", () => {
    expect(() => normalizeNews({ title: "t", summary: "a".repeat(401) })).toThrow(/largo/)
  })
})

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>Valorant: nuevo mapa llega al torneo &amp; más</title><link>https://ej.com/a</link>
<description><![CDATA[<p>Riot presentó un <b>nuevo mapa</b> para el circuito competitivo.</p>]]></description><pubDate>Tue, 20 Oct 2026 10:00:00 GMT</pubDate></item>
<item><title>Sin enlace</title></item>
<item><title>Nvidia presenta una nueva RTX</title><link>https://ej.com/b</link><description>Más rendimiento.</description></item>
</channel></rss>`

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<entry><title>Halo recibe actualización</title><link rel="alternate" href="https://ej.com/c"/><summary>Parche de otoño.</summary><published>2026-10-19T08:00:00Z</published></entry>
</feed>`

describe("parseFeed", () => {
  it("lee RSS: decodifica entidades, quita HTML y descarta entradas sin enlace", () => {
    const items = parseFeed(RSS)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      title: "Valorant: nuevo mapa llega al torneo & más",
      link: "https://ej.com/a",
      summary: "Riot presentó un nuevo mapa para el circuito competitivo.",
    })
    expect(items[0].publishedAt).toEqual(new Date("Tue, 20 Oct 2026 10:00:00 GMT"))
    expect(items[1].publishedAt).toBeNull()
  })

  it("lee Atom", () => {
    expect(parseFeed(ATOM)).toEqual([
      { title: "Halo recibe actualización", link: "https://ej.com/c", summary: "Parche de otoño.", publishedAt: new Date("2026-10-19T08:00:00Z") },
    ])
  })

  it("un XML sin entradas devuelve una lista vacía", () => {
    expect(parseFeed("<rss><channel></channel></rss>")).toEqual([])
  })

  it("recorta los extractos largos en un límite de palabra", () => {
    const text = toExcerpt(`<p>${"palabra ".repeat(60)}</p>`, 100)
    expect(text.length).toBeLessThanOrEqual(104)
    expect(text.endsWith("...")).toBe(true)
    expect(text).not.toMatch(/palabr\.\.\./)
  })
})

describe("clasificación", () => {
  it("detecta el juego y la categoría por el texto", () => {
    expect(guessGame("GTA VI confirma fecha")).toBe("gta")
    expect(guessGame("EA SPORTS FC 26 llega")).toBe("fifa")
    expect(guessGame("Mundial de League of Legends")).toBe("lol")
    expect(guessGame("Nada que ver")).toBeNull()
    expect(guessCategory("Final del torneo de Valorant")).toBe("esports")
    expect(guessCategory("Nvidia lanza una GPU")).toBe("hardware")
    expect(guessCategory("Sale el trailer")).toBe("lanzamientos")
    expect(guessCategory("Reportaje sobre la industria")).toBe("industria")
  })

  it("lee las fuentes de NEWS_RSS_FEEDS y descarta las que no son http", () => {
    expect(feedsFromEnv({ NEWS_RSS_FEEDS: " https://a.com/rss , ftp://x, , http://b.com/feed " } as never)).toEqual([
      "https://a.com/rss",
      "http://b.com/feed",
    ])
    expect(feedsFromEnv({} as never)).toEqual([])
  })
})

describe("importFeeds", () => {
  const makeService = (existing: { slug: string; source_url: string | null }[] = []) => {
    const created: Record<string, unknown>[] = []
    return {
      created,
      service: {
        listNewsPosts: jest.fn().mockResolvedValue(existing),
        createNewsPosts: jest.fn().mockImplementation(async (data: Record<string, unknown>) => {
          created.push(data)
          return data
        }),
      } as never,
    }
  }

  it("crea borradores sin imagen y marca su origen", async () => {
    const { service, created } = makeService()
    const result = await importFeeds(service, ["https://f/1"], { fetcher: async () => RSS })
    expect(result).toEqual({ created: 2, skipped: 0, errors: [] })
    expect(created[0]).toMatchObject({
      status: "draft",
      origin: "rss",
      category: "esports",
      game: "valorant",
      source_url: "https://ej.com/a",
      source_name: "ej.com",
    })
    expect(created[0]).not.toHaveProperty("image_url")
  })

  it("no repite notas ya importadas ni dentro de la misma corrida", async () => {
    const { service } = makeService([{ slug: "x", source_url: "https://ej.com/a" }])
    const result = await importFeeds(service, ["https://f/1", "https://f/2"], { fetcher: async () => RSS })
    expect(result.created).toBe(1)
    expect(result.skipped).toBe(3)
  })

  it("una fuente caída no detiene a las demás", async () => {
    const { service } = makeService()
    const result = await importFeeds(service, ["https://f/mala", "https://f/buena"], {
      fetcher: async (url) => {
        if (url.endsWith("mala")) {
          throw new Error("HTTP 503")
        }
        return ATOM
      },
    })
    expect(result.created).toBe(1)
    expect(result.errors).toEqual([{ feed: "https://f/mala", error: "HTTP 503" }])
  })

  it("respeta el máximo por fuente", async () => {
    const { service } = makeService()
    const result = await importFeeds(service, ["https://f/1"], { perFeed: 1, fetcher: async () => RSS })
    expect(result.created).toBe(1)
  })
})

describe("decodeBody", () => {
  it("lee UTF-8 por defecto", () => {
    expect(decodeBody(Buffer.from("<rss>mañana</rss>", "utf8"), "text/xml")).toBe("<rss>mañana</rss>")
  })

  it("respeta el charset del encabezado y de la declaración XML", () => {
    const latin = Buffer.from("<rss>mañana</rss>", "latin1")
    expect(decodeBody(latin, "text/xml; charset=ISO-8859-1")).toBe("<rss>mañana</rss>")
    const withDeclaration = Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><rss>niño</rss>', "latin1")
    expect(decodeBody(withDeclaration, "text/xml")).toContain("niño")
  })

  it("un charset desconocido cae a UTF-8 sin romper", () => {
    expect(decodeBody(Buffer.from("hola", "utf8"), "text/xml; charset=raro-99")).toBe("hola")
  })
})
