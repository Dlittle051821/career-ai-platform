import type { CSSProperties } from "react";
import { V4_MOBILE_MEDIA, type V4ImageSet } from "@/lib/home/v4/images";

type V4PictureProps = {
  image: V4ImageSet;
  /** `sizes` for the desktop composition (see desktopSizes()). */
  sizes: string;
  /** Optional art-directed image for the mobile composition. */
  mobileImage?: V4ImageSet;
  /** `sizes` for the mobile composition (see mobileSizes()). */
  mobileSizes?: string;
  alt: string;
  objectPosition?: string;
  /** The hero: fetched first. Everything else loads lazily at low priority. */
  priority?: boolean;
};

/**
 * Responsive, art-directed photograph for the V4 stage. Fills its parent
 * (object-fit: cover — the equivalent of the prototype's
 * `background-size: cover`), so the engine can keep transforming the
 * wrapping element exactly as before.
 */
export function V4Picture({ image, sizes, mobileImage, mobileSizes, alt, objectPosition, priority = false }: V4PictureProps) {
  const mobile = mobileImage ?? image;
  const style: CSSProperties | undefined = objectPosition ? { objectPosition } : undefined;
  return (
    <picture className="nw4-pic">
      {mobileSizes ? (
        <>
          <source media={V4_MOBILE_MEDIA} type="image/avif" srcSet={mobile.avif} sizes={mobileSizes} />
          <source media={V4_MOBILE_MEDIA} type="image/webp" srcSet={mobile.webp} sizes={mobileSizes} />
        </>
      ) : null}
      <source type="image/avif" srcSet={image.avif} sizes={sizes} />
      <source type="image/webp" srcSet={image.webp} sizes={sizes} />
      <img
        src={image.fallback}
        alt={alt}
        width={image.width}
        height={image.height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "low"}
        decoding="async"
        draggable={false}
        style={style}
      />
    </picture>
  );
}
