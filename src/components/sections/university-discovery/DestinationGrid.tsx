import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { UNIVERSITY_DESTINATIONS, type UniversityDestination } from "@/lib/education/university-discovery/destinations";
import type { V4ImageSet } from "@/lib/home/v4/images";
import { CountryFlag } from "./CountryFlag";

export function DestinationPicture({ image, alt, sizes, priority = false }: { image: V4ImageSet; alt: string; sizes: string; priority?: boolean }) {
  return (
    <picture>
      <source type="image/avif" srcSet={image.avif} sizes={sizes} />
      <source type="image/webp" srcSet={image.webp} sizes={sizes} />
      <img src={image.fallback} alt={alt} width={image.width} height={image.height} loading={priority ? "eager" : "lazy"} decoding="async" />
    </picture>
  );
}

/**
 * The six destination cards (flag, approved photograph, name, descriptor).
 * Real links, so selection is a shareable URL and works without JavaScript.
 */
export function DestinationGrid({ basePath, ariaLabel }: { basePath: "/universities" | "/courses"; ariaLabel: string }) {
  return (
    <ul className="ud-dest-grid" aria-label={ariaLabel}>
      {UNIVERSITY_DESTINATIONS.map((destination: UniversityDestination, index) => (
        <li key={destination.code}>
          <Link href={`${basePath}?destination=${destination.slug}`} className="ud-dest" style={{ "--i": index } as CSSProperties}>
            <DestinationPicture image={destination.image} alt="" sizes="(max-width: 720px) 100vw, (max-width: 1100px) 33vw, 220px" priority={index < 3} />
            <span className="ud-dest-loc">{destination.photoLocation}</span>
            <span className="ud-dest-go" aria-hidden="true"><ArrowRight /></span>
            <span className="ud-dest-text">
              <span className="ud-dest-name"><CountryFlag code={destination.code} /><b>{destination.name}</b></span>
              <small>{destination.descriptor}</small>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
