import Image from "next/image";
import { ImageOff } from "lucide-react";
import type { CareerPhoto as CareerPhotoData } from "@/lib/career-explorer/photos";

/**
 * A career (or career-family) photograph in a fixed 8:5 frame, so nothing
 * shifts while it loads. With no approved photograph it shows a neutral tile
 * — never a stand-in picture of a different job.
 */
export function CareerPhoto({
  photo,
  sizes,
  className,
  priority = false,
  decorative = false,
}: {
  photo: CareerPhotoData | null;
  sizes: string;
  className?: string;
  priority?: boolean;
  /** True when the photo sits next to text that already names the career (alt is then empty). */
  decorative?: boolean;
}) {
  const cls = className ? `ce-photo ${className}` : "ce-photo";
  if (!photo) {
    return (
      <span className={cls} data-empty="" aria-hidden="true">
        <ImageOff />
      </span>
    );
  }
  return (
    <span className={cls}>
      <Image src={photo.src} alt={decorative ? "" : photo.alt} fill sizes={sizes} priority={priority} />
    </span>
  );
}
