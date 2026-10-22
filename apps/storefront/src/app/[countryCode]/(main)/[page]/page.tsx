import { Metadata } from "next"
import { notFound } from "next/navigation"

import { INFO_PAGES, getInfoPage, isDraftPage } from "@lib/info-pages"

type Props = { params: Promise<{ page: string; countryCode: string }> }

export function generateStaticParams() {
  return INFO_PAGES.map((page) => ({ page: page.slug }))
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { page: slug } = await props.params
  const page = getInfoPage(slug)

  if (!page) {
    return {}
  }

  return {
    title: page.title,
    description: page.description,
    // Mientras tenga marcadores [COMPLETAR] o sea un borrador legal, no debe indexarse.
    robots: isDraftPage(page) ? { index: false, follow: false } : undefined,
  }
}

export default async function InfoPageRoute(props: Props) {
  const { page: slug } = await props.params
  const page = getInfoPage(slug)

  if (!page) {
    notFound()
  }

  return (
    <div className="content-container py-14">
      <article className="mx-auto max-w-3xl" data-testid={`info-page-${page.slug}`}>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight small:text-5xl">{page.title}</h1>
        {page.intro && <p className="mt-4 text-lg text-ui-fg-subtle">{page.intro}</p>}

        <div className="mt-10 flex flex-col gap-y-8">
          {page.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold text-ui-fg-base">{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-ui-fg-subtle leading-7">
                  {paragraph}
                </p>
              ))}
              {section.list && (
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ui-fg-subtle leading-7">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </article>
    </div>
  )
}
