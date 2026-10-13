import Link from "next/link";
import { ArrowRight, Scale } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getFamilyPresentation, FAMILY_TONE_CLASSES } from "@/lib/careers/family-presentation";
import { HOVER_LIFT_CLASSES } from "@/lib/ui/motion";
import { cn } from "@/lib/utils";
import type { CareerSummary } from "@/types/career";

const MAX_VISIBLE_TAGS = 3;

/** Bare career title, used only as a display fallback — CAREER_TAG label lookup happens where tag options are in scope. */
function humanizeTag(tagKey: string): string {
  return tagKey
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * UX10-C01 — restyled to match the reference mockup's card treatment
 * (icon header, shadow, rounded corners) while changing no real data or
 * links. `CareerSummary` (the real search-result shape) has no per-career
 * image field — no photo exists anywhere in this product's career data
 * model — so a colored family icon chip (real, driven by the career's own
 * real `familyKey`) stands in for the mockup's photographic card images,
 * the same "no fabricated per-item image" choice UX10-D01's dashboard made
 * for its Course/University "coming soon" cards. No heart/save icon: the
 * real saved-items system (`src/lib/supabase/education/saved-items.ts`,
 * `SavedItemEntityType`) only supports `"university"` and `"course"` —
 * `"career"` has no real save capability to wire up, so one isn't shown.
 * "Compare" is real and unchanged (`/compare?a=slug`, already wired).
 */
export function CareerCard({ career }: { career: CareerSummary }) {
  const { icon: Icon, tone } = getFamilyPresentation(career.familyKey);
  const toneClasses = FAMILY_TONE_CLASSES[tone];

  return (
    <Card as="article" className={cn("flex h-full flex-col overflow-hidden !p-0 shadow-soft", HOVER_LIFT_CLASSES)}>
      <div className={cn("flex items-center justify-between px-6 py-5", toneClasses.bg)}>
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-surface/80", toneClasses.fg)}>
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
        {career.isFeatured ? <Badge tone="accent">Featured</Badge> : null}
      </div>

      <div className="flex flex-1 flex-col p-6 pt-5">
        <Badge tone="info" className="self-start">
          {career.familyName}
        </Badge>

        <h3 className="mt-3 text-lg font-semibold text-primary">{career.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{career.summary}</p>

        {career.tagKeys.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {career.tagKeys.slice(0, MAX_VISIBLE_TAGS).map((tagKey) => (
              <Badge key={tagKey} tone="neutral" className="text-[11px]">
                {humanizeTag(tagKey)}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4">
          <Link
            href={`/careers/${career.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-dark transition-colors hover:text-primary"
          >
            Explore Career
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
          <Link href={`/compare?a=${career.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-primary">
            <Scale aria-hidden="true" className="h-3.5 w-3.5" />
            Compare
          </Link>
        </div>
      </div>
    </Card>
  );
}
