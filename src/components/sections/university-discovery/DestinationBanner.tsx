import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { UniversityDestination } from "@/lib/education/university-discovery/destinations";
import { CountryFlag } from "./CountryFlag";
import { DestinationPicture } from "./DestinationGrid";

export function DestinationBanner({ destination, title, description, backHref }: { destination: UniversityDestination; title: string; description: string; backHref: string }) {
  return (
    <div className="ud-banner">
      <DestinationPicture image={destination.image} alt={`${destination.photoLocation}, ${destination.name}`} sizes="(max-width: 1400px) 100vw, 1344px" priority />
      <Link href={backHref} className="ud-banner-back"><ArrowLeft aria-hidden="true" />All destinations</Link>
      <div className="ud-banner-text">
        <div className="ud-banner-name"><CountryFlag code={destination.code} size="lg" /><h1>{title}</h1></div>
        <p>{description}</p>
      </div>
    </div>
  );
}
