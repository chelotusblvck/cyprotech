import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

// Cambia el dominio guardado en las imagenes de los productos (thumbnail e images) cuando cambia
// la URL publica del backend. Las imagenes subidas guardan la URL completa, por eso no basta con
// cambiar BACKEND_PUBLIC_URL.
// Uso: npx medusa exec ./src/scripts/rewrite-media-host.ts <host-viejo> <host-nuevo> [dry-run]
// Ejemplo: ... rewrite-media-host.js https://cypro-api.garage360.cl https://cyprotech.cl dry-run
export default async function rewriteMediaHost({ container, args }: ExecArgs) {
  const [from, to] = (args ?? []).filter((arg) => arg.startsWith("http")).map((arg) => arg.replace(/\/+$/, ""))
  const dryRun = (args ?? []).includes("dry-run")
  if (!from || !to) {
    console.log("Uso: rewrite-media-host <host-viejo> <host-nuevo> [dry-run]")
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "thumbnail", "images.id", "images.url"],
  })
  const products = data as { id: string; title: string; thumbnail: string | null; images: { id: string; url: string }[] }[]
  const swap = (url: string) => (url.startsWith(from) ? `${to}${url.slice(from.length)}` : url)

  let changed = 0
  for (const product of products) {
    const images = product.images ?? []
    const thumbnailChanged = !!product.thumbnail && swap(product.thumbnail) !== product.thumbnail
    const imagesChanged = images.some((image) => swap(image.url) !== image.url)
    if (!thumbnailChanged && !imagesChanged) {
      continue
    }
    changed += 1
    console.log(`${dryRun ? "cambiaria" : "actualiza "} ${product.title.slice(0, 70)} (${images.length} imagenes)`)
    if (dryRun) {
      continue
    }
    // Con el workflow se emite product.updated y el indice de busqueda se entera.
    await updateProductsWorkflow(container).run({
      input: {
        selector: { id: product.id },
        update: {
          ...(thumbnailChanged ? { thumbnail: swap(product.thumbnail as string) } : {}),
          ...(imagesChanged ? { images: images.map((image) => ({ url: swap(image.url) })) } : {}),
        },
      },
    })
  }
  console.log(`${products.length} productos revisados, ${changed} ${dryRun ? "cambiarian" : "actualizados"}.`)
}
