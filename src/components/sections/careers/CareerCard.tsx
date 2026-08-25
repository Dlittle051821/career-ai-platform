import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { CareerSummary } from "@/types/career";

const MAX_VISIBLE_TAGS = 3;

/** Bare career title, used only as a display fallback — CAREER_TAG label lookup happens where tag options are in scope. */
function humanizeTag(tagKey: string): string {
  return tagKey
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function CareerCard({ career }: { career: CareerSummary }) {
  return (
    <Card as="article" className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2">
        <Badge tone="info">{career.familyName}</Badge>
        {career.isFeatured ? <Badge tone="accent">Featured</Badge> : null}
      </div>

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

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href={`/careers/${career.slug}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-dark transition-colors hover:text-primary"
        >
          Explore Career
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
        <Link href={`/compare?a=${career.slug}`} className="text-sm font-medium text-muted transition-colors hover:text-primary">
          Compare
        </Link>
      </div>
    </Card>
  );
}
