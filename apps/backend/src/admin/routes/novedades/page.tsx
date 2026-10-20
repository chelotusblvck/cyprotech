import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Newspaper } from "@medusajs/icons"
import { Badge, Button, Container, Drawer, Heading, Input, Label, Select, Switch, Table, Text, Textarea, toast, usePrompt } from "@medusajs/ui"
import { useState } from "react"

import { api, useApi } from "../../lib/api"
import { dateTime } from "../../lib/format"

declare const __BACKEND_URL__: string | undefined
const BASE = (typeof __BACKEND_URL__ === "string" ? __BACKEND_URL__ : "").replace(/\/+$/, "")

type Post = {
  id: string
  title: string
  slug: string
  summary: string
  body: string | null
  image_url: string | null
  image_alt: string | null
  image_credit: string | null
  category: string
  game: string | null
  source_name: string | null
  source_url: string | null
  status: "draft" | "published"
  featured: boolean
  published_at: string | null
  origin: string
}

const CATEGORIES: Record<string, string> = {
  lanzamientos: "Lanzamientos",
  esports: "Esports",
  hardware: "Hardware",
  guias: "Guías",
  industria: "Industria",
}

const GAMES: Record<string, string> = {
  "": "Sin juego (arte de la categoría)",
  gta: "GTA",
  fifa: "EA SPORTS FC / FIFA",
  halo: "Halo",
  valorant: "Valorant",
  lol: "League of Legends",
  overwatch: "Overwatch",
  esports: "Esports en general",
}

const EMPTY = {
  title: "",
  summary: "",
  body: "",
  image_url: "",
  image_alt: "",
  image_credit: "",
  category: "industria",
  game: "",
  source_name: "",
  source_url: "",
  status: "draft" as "draft" | "published",
  featured: false,
}
type Form = typeof EMPTY

const toForm = (post: Post): Form => ({
  title: post.title,
  summary: post.summary,
  body: post.body ?? "",
  image_url: post.image_url ?? "",
  image_alt: post.image_alt ?? "",
  image_credit: post.image_credit ?? "",
  category: post.category,
  game: post.game ?? "",
  source_name: post.source_name ?? "",
  source_url: post.source_url ?? "",
  status: post.status,
  featured: post.featured,
})

// Sube la imagen al módulo de archivos de Medusa y devuelve su URL pública.
const uploadImage = async (file: File): Promise<string> => {
  const body = new FormData()
  body.append("files", file)
  const response = await fetch(`${BASE}/admin/uploads`, { method: "POST", credentials: "include", body })
  if (!response.ok) {
    throw new Error("No se pudo subir la imagen.")
  }
  const payload = (await response.json()) as { files: { url: string }[] }
  return payload.files[0].url
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-y-1.5">
    <Label size="small" weight="plus">
      {label}
    </Label>
    {children}
    {hint ? (
      <Text size="xsmall" className="text-ui-fg-muted">
        {hint}
      </Text>
    ) : null}
  </div>
)

const NewsPage = () => {
  const { data, error, reload } = useApi<{ posts: Post[]; count: number }>("/admin/news")
  const [editing, setEditing] = useState<Post | "new" | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [busy, setBusy] = useState<string | null>(null)
  const prompt = usePrompt()

  const open = (post: Post | "new") => {
    setForm(post === "new" ? EMPTY : toForm(post))
    setEditing(post)
  }
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key)
    try {
      await action()
      toast.success(success)
      await reload()
      return true
    } catch (err) {
      toast.error((err as Error).message)
      return false
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    const ok = await run(
      "save",
      () =>
        editing === "new"
          ? api("/admin/news", { method: "POST", body: form })
          : api(`/admin/news/${(editing as Post).id}`, { method: "POST", body: form }),
      editing === "new" ? "Nota creada" : "Nota guardada",
    )
    if (ok) {
      setEditing(null)
    }
  }

  const togglePublish = (post: Post) =>
    run(
      `pub-${post.id}`,
      () => api(`/admin/news/${post.id}`, { method: "POST", body: { status: post.status === "published" ? "draft" : "published" } }),
      post.status === "published" ? "Nota despublicada" : "Nota publicada",
    )

  const remove = async (post: Post) => {
    const ok = await prompt({
      title: "Eliminar nota",
      description: `Se elimina "${post.title}" definitivamente.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
    })
    if (ok) {
      await run(`del-${post.id}`, () => api(`/admin/news/${post.id}`, { method: "DELETE" }), "Nota eliminada")
    }
  }

  const importFeeds = () =>
    run(
      "import",
      async () => {
        const result = await api<{ created: number; skipped: number; errors: unknown[] }>("/admin/news/import", { method: "POST", body: {} })
        toast.info(`${result.created} borradores nuevos, ${result.skipped} ya existían, ${result.errors.length} fuentes con error.`)
      },
      "Importación terminada",
    )

  const upload = async (file: File | undefined) => {
    if (!file) {
      return
    }
    setBusy("upload")
    try {
      set("image_url", await uploadImage(file))
      toast.success("Imagen subida")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const posts = data?.posts ?? []

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="flex items-center justify-between p-6">
        <div>
          <Heading>Novedades</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Notas de la comunidad que se muestran en la portada y en /novedades.
          </Text>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" isLoading={busy === "import"} onClick={importFeeds}>
            Importar de RSS
          </Button>
          <Button onClick={() => open("new")}>Nueva nota</Button>
        </div>
      </Container>

      <Container className="p-0">
        {error && !data ? (
          <Text className="p-6 text-ui-fg-error">{error}</Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Título</Table.HeaderCell>
                <Table.HeaderCell>Categoría</Table.HeaderCell>
                <Table.HeaderCell>Estado</Table.HeaderCell>
                <Table.HeaderCell>Publicada</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {posts.map((post) => (
                <Table.Row key={post.id}>
                  <Table.Cell>
                    <div className="flex flex-col">
                      <span className="font-medium">{post.title}</span>
                      <span className="text-xs text-ui-fg-muted">
                        {post.origin === "rss" ? "Importada · " : ""}
                        {post.image_url ? "Con banner propio" : "Usa arte de respaldo"}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{CATEGORIES[post.category] ?? post.category}</Table.Cell>
                  <Table.Cell>
                    <Badge size="2xsmall" color={post.status === "published" ? "green" : "orange"}>
                      {post.status === "published" ? "Publicada" : "Borrador"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>{dateTime(post.published_at)}</Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end gap-2">
                      <Button size="small" variant="secondary" onClick={() => open(post)}>
                        Editar
                      </Button>
                      <Button size="small" variant="secondary" isLoading={busy === `pub-${post.id}`} onClick={() => togglePublish(post)}>
                        {post.status === "published" ? "Despublicar" : "Publicar"}
                      </Button>
                      <Button size="small" variant="danger" isLoading={busy === `del-${post.id}`} onClick={() => remove(post)}>
                        Eliminar
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
              {!posts.length ? (
                <Table.Row>
                  <Table.Cell className="text-ui-fg-muted">Todavía no hay notas.</Table.Cell>
                </Table.Row>
              ) : null}
            </Table.Body>
          </Table>
        )}
      </Container>

      <Drawer open={editing !== null} onOpenChange={(value) => !value && setEditing(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{editing === "new" ? "Nueva nota" : "Editar nota"}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
            <Field label="Título">
              <Input value={form.title} onChange={(event) => set("title", event.target.value)} />
            </Field>
            <Field label="Resumen" hint={`Con tus palabras, 1 o 2 frases. ${form.summary.length}/400`}>
              <Textarea rows={3} value={form.summary} onChange={(event) => set("summary", event.target.value)} />
            </Field>
            <Field label="Cuerpo (opcional)" hint="Párrafos separados por una línea en blanco.">
              <Textarea rows={7} value={form.body} onChange={(event) => set("body", event.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Categoría">
                <Select value={form.category} onValueChange={(value) => set("category", value)}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {Object.entries(CATEGORIES).map(([key, label]) => (
                      <Select.Item key={key} value={key}>
                        {label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </Field>
              <Field label="Juego" hint="Elige el arte de respaldo.">
                <Select value={form.game || "none"} onValueChange={(value) => set("game", value === "none" ? "" : value)}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {Object.entries(GAMES).map(([key, label]) => (
                      <Select.Item key={key || "none"} value={key || "none"}>
                        {label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </Field>
            </div>

            <Field label="Banner" hint="Horizontal, de preferencia 1600 x 700. Solo imágenes con derechos de uso.">
              {form.image_url ? (
                <img src={form.image_url} alt="" className="h-28 w-full rounded-md border border-ui-border-base object-cover" />
              ) : null}
              <div className="flex gap-2">
                <Input placeholder="https://... o /novedades/imagen.jpg" value={form.image_url} onChange={(event) => set("image_url", event.target.value)} />
                <label className="inline-flex shrink-0 cursor-pointer items-center rounded-md border border-ui-border-base bg-ui-button-neutral px-3 text-sm hover:bg-ui-button-neutral-hover">
                  {busy === "upload" ? "Subiendo..." : "Subir"}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="hidden" onChange={(event) => upload(event.target.files?.[0])} />
                </label>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Texto alternativo">
                <Input value={form.image_alt} onChange={(event) => set("image_alt", event.target.value)} />
              </Field>
              <Field label="Crédito de la imagen">
                <Input placeholder="Rockstar Games" value={form.image_credit} onChange={(event) => set("image_credit", event.target.value)} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Fuente">
                <Input placeholder="Nombre del medio" value={form.source_name} onChange={(event) => set("source_name", event.target.value)} />
              </Field>
              <Field label="Enlace a la fuente">
                <Input placeholder="https://..." value={form.source_url} onChange={(event) => set("source_url", event.target.value)} />
              </Field>
            </div>

            <div className="flex items-center justify-between rounded-md border border-ui-border-base p-3">
              <div>
                <Text size="small" weight="plus">
                  Publicar ahora
                </Text>
                <Text size="xsmall" className="text-ui-fg-muted">
                  Si está apagado queda como borrador y no se ve en la tienda.
                </Text>
              </div>
              <Switch checked={form.status === "published"} onCheckedChange={(value) => set("status", value ? "published" : "draft")} />
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Cancelar</Button>
            </Drawer.Close>
            <Button isLoading={busy === "save"} onClick={save}>
              Guardar
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Novedades",
  icon: Newspaper,
})

export default NewsPage
