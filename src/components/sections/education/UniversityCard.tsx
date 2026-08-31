import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EDUCATION_FRESHNESS_BAND_LABELS } from "@/types/education";
import type { PublicUniversitySummary } from "@/lib/supabase/education/universities";

/** "online_platform" -> "Online platform", "on_campus" -> "On campus". Shared display helper for any snake_case education enum value — used here and by the university detail page. */
export function humanizeEnumValue(value: string): string {
  const words = value.split("_");
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
}

const FRESHNESS_TONE: Record<string, "success" | "warning" | "error" | "neutral"> = {
  current: "success",
  review_soon: "warning",
  stale: "error",
  unknown: "neutral",
};

export function FreshnessBadge({ band }: { band: keyof typeof EDUCATION_FRESHNESS_BAND_LABELS }) {
  return (
    <Badge tone={FRESHNESS_TONE[band] ?? "neutral"} className="text-[11px]">
      {EDUCATION_FRESHNESS_BAND_LABELS[band]}
    </Badge>
  );
}

const MAX_VISIBLE_STUDY_LEVELS = 3;

export function UniversityCard({ university }: { university: PublicUniversitySummary }) {
  const location = [university.city, university.countryName].filter(Boolean).join(", ");

  return (
    <Card as="article" className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        {university.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external, unconfigured logo host; a plain <img> avoids requiring every institution's domain in next.config's image allowlist.
          <img
            src={university.logoUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-[var(--radius-control)] border border-border bg-surface-alt object-contain"
          />
        ) : null}
        <div className="ml-auto">
          <FreshnessBadge band={university.freshnessBand} />
        </div>
      </div>

      <h3 className="mt-3 text-lg font-semibold text-primary">{university.name}</h3>

      {location ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
          <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {location}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {university.institutionType ? (
          <Badge tone="info" className="text-[11px]">
            {humanizeEnumValue(university.institutionType)}
          </Badge>
        ) : null}
        {university.ownershipType ? (
          <Badge tone="neutral" className="text-[11px]">
            {humanizeEnumValue(university.ownershipType)}
          </Badge>
        ) : null}
      </div>

      {university.studyLevels.length > 0 ? (
        <p className="mt-3 flex-1 text-sm text-text-soft">
          {university.studyLevels.slice(0, MAX_VISIBLE_STUDY_LEVELS).map(humanizeEnumValue).join(" · ")}
        </p>
      ) : (
        <div className="flex-1" />
      )}

      <Link
        href={`/universities/${university.slug}`}
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-dark transition-colors hover:text-primary"
      >
        View university
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </Card>
  );
}
