import { Metadata } from "next"

import { BRAND } from "@lib/brand"
import { getRegion } from "@lib/data/regions"
import CategoryTiles from "@modules/home/components/category-tiles"
import FeaturedLatest from "@modules/home/components/featured-latest"
import Hero from "@modules/home/components/hero"
import NewsSection from "@modules/home/components/news-section"
import TrustStrip from "@modules/home/components/trust-strip"

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} | ${BRAND.tagline}` },
  description: BRAND.description,
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params
  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  return (
    <>
      <Hero />
      <TrustStrip />
      <CategoryTiles />
      <NewsSection />
      <FeaturedLatest region={region} />
    </>
  )
}
