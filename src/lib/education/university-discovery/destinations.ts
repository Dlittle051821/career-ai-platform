import { EUROPE_COUNTRIES, type EuropeCountryCode } from "@/data/europe-explorer";
import { destDe, destDk, destFr, destIe, destNl, destSe, type V4ImageSet } from "@/lib/home/v4/images";

/**
 * University Discovery V3 — the destination cards.
 *
 * Deliberately NOT a second country list: the six destinations, their names,
 * slugs and official sources come from the approved Europe country
 * configuration (src/data/europe-explorer.ts). This file only adds what the
 * V3 cards need on top: the approved destination photograph (already shipped
 * for the homepage; provenance in docs/home-v4/ASSET-MANIFEST.md), the place
 * that photograph shows, and one short descriptor taken from the same
 * configuration's own `englishAvailability` wording.
 */
export interface UniversityDestination {
  code: EuropeCountryCode;
  name: string;
  slug: string;
  image: V4ImageSet;
  /** Where the approved photograph was taken, as recorded in the asset manifest. */
  photoLocation: string;
  descriptor: string;
}

const PRESENTATION: Record<EuropeCountryCode, { image: V4ImageSet; photoLocation: string; descriptor: string }> = {
  DE: { image: destDe, photoLocation: "Heidelberg", descriptor: "Many English-taught Master's programmes" },
  IE: { image: destIe, photoLocation: "Trinity College Dublin", descriptor: "English-speaking study destination" },
  NL: { image: destNl, photoLocation: "Delft", descriptor: "Wide range of English-taught programmes" },
  FR: { image: destFr, photoLocation: "Sorbonne, Paris", descriptor: "Growing English-taught options" },
  SE: { image: destSe, photoLocation: "Uppsala", descriptor: "Many English-taught Master's programmes" },
  DK: { image: destDk, photoLocation: "Nyhavn, Copenhagen", descriptor: "Good range of English-taught programmes" },
};

export const UNIVERSITY_DESTINATIONS: readonly UniversityDestination[] = EUROPE_COUNTRIES.map((country) => ({
  code: country.code,
  name: country.name,
  slug: country.slug,
  ...PRESENTATION[country.code],
}));

export function getUniversityDestination(value: string | null | undefined): UniversityDestination | null {
  if (!value) return null;
  const needle = value.trim().toLowerCase();
  return UNIVERSITY_DESTINATIONS.find((d) => d.slug === needle || d.code.toLowerCase() === needle) ?? null;
}

/**
 * Reviewed presentation copy for official discovery portals, keyed by the
 * portal's official domain. Copy only: the outbound URL itself always comes
 * from the trusted-source registry in the database and leaves through the
 * validated /go/course-search redirect. A portal with no entry here is still
 * listed, with its name and domain alone. Nothing here claims a partnership.
 */
export interface OfficialResourceCopy {
  category: string;
  summary: string;
}

export const OFFICIAL_RESOURCE_COPY: Readonly<Record<string, OfficialResourceCopy>> = {
  "daad.de": {
    category: "Official study guidance",
    summary: "Explore Germany's higher education opportunities through DAAD's official study resources.",
  },
  "hochschulkompass.de": {
    category: "Institution directory",
    summary:
      "Find information about higher education institutions and study opportunities in Germany. An information portal of the German Rectors' Conference (HRK).",
  },
  "study-in-germany.de": {
    category: "International students",
    summary: "DAAD's portal for international students planning their studies in Germany.",
  },
  "study-in-germany.com": {
    category: "International students",
    summary: "DAAD's portal for international students planning their studies in Germany.",
  },
};

export function getOfficialResourceCopy(officialDomain: string): OfficialResourceCopy | null {
  return OFFICIAL_RESOURCE_COPY[officialDomain.trim().toLowerCase().replace(/^www\./, "")] ?? null;
}
