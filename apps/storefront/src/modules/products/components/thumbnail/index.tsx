import { Container, clx } from "@modules/common/components/ui"
import Image from "next/image"
import React from "react"

type ThumbnailProps = {
  thumbnail?: string | null
  images?: { url?: string }[] | null
  size?: "small" | "medium" | "large" | "full" | "square"
  isFeatured?: boolean
  className?: string
  "data-testid"?: string
}

const Thumbnail: React.FC<ThumbnailProps> = ({
  thumbnail,
  images,
  size = "small",
  isFeatured,
  className,
  "data-testid": dataTestid,
}) => {
  const initialImage = thumbnail || images?.[0]?.url

  return (
    <Container
      className={clx(
        "relative w-full overflow-hidden p-4 rounded-large border border-ui-border-base transition-all ease-in-out duration-200 group-hover:border-vio-300 group-hover:shadow-[0_0_30px_-6px_rgba(168,85,247,0.7)]",
        initialImage
          ? "bg-gradient-to-b from-[#f7f4ff] to-[#e4d9fa]"
          : "bg-gradient-to-br from-vio-900/70 via-ui-bg-base to-vio-950",
        className,
        {
          "aspect-[1/1]": isFeatured || size === "square" || size === "full",
          "aspect-[9/16]": !isFeatured && size !== "square" && size !== "full",
          "w-[180px]": size === "small",
          "w-[290px]": size === "medium",
          "w-[440px]": size === "large",
          "w-full": size === "full",
        }
      )}
      data-testid={dataTestid}
    >
      <ImageOrPlaceholder image={initialImage} size={size} />
    </Container>
  )
}

const ImageOrPlaceholder = ({
  image,
  size,
}: Pick<ThumbnailProps, "size"> & { image?: string }) => {
  return image ? (
    <Image
      src={image}
      alt="Imagen del producto"
      className="absolute inset-0 object-contain object-center p-4 transition-transform duration-300 group-hover:scale-105"
      draggable={false}
      quality={50}
      sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
      fill
    />
  ) : (
    <div className="w-full h-full absolute inset-0 flex items-center justify-center">
      <svg
        viewBox="0 0 32 32"
        className="h-1/3 w-1/3 opacity-60 drop-shadow-[0_0_14px_rgba(168,85,247,0.8)]"
        aria-hidden="true"
      >
        <path
          d="M16 2 28 9v14L16 30 4 23V9z"
          fill="none"
          stroke="#a855f7"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M21 12.2a6 6 0 1 0 0 7.6"
          fill="none"
          stroke="#ff2bd6"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export default Thumbnail
