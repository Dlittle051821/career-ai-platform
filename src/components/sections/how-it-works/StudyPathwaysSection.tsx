import Link from "next/link";
import { CircleCheck, Globe2, Landmark } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { PATHWAY_CARDS } from "@/data/study-options";

/**
 * UX10-HW01 — the reference image's "Two Pathways, One Goal" section
 * (annotation #3). Reuses the REAL, already-published `PATHWAY_CARDS`
 * entries from `src/data/study-options.ts` verbatim (summary + all 4
 * points per pathway) rather than writing new claims — the exact same
 * "india" and "europe" cards the `/study-options` page already renders.
 * No new statistics, partnerships, or outcomes are introduced.
 *
 * CTAs link to `/study-options#india` and (as of UX10-EU01) `/study-europe`
 * — real anchors/routes on those pages' own pathway content. The Europe CTA
 * originally pointed at `/study-options#europe` (the anchor added to that
 * page's own pathway card in the UX10-HW01 pass); UX10-EU01 repoints it to
 * the new dedicated `/study-europe` Country Explorer route instead, since
 * that page is now the richer, more specific Europe destination — see
 * `/study-europe/page.tsx`'s own docblock for the full route-decision
 * reasoning. This is a deliberate, documented post-HW01 update to this
 * shared file, made as part of the UX10-EU01 milestone.
 */
const EUROPE = PATHWAY_CARDS.find((pathway) => pathway.id === "europe");
const INDIA = PATHWAY_CARDS.find((pathway) => pathway.id === "india");

const PATHWAY_PRESENTATION = [
  {
    pathway: EUROPE,
    icon: Globe2,
    href: "/study-europe",
    cta: "Explore Europe options",
    pale: "var(--surface-soft-blue)",
    strong: "var(--surface-soft-blue-strong)",
    buttonVariant: "primary" as const,
  },
  {
    pathway: INDIA,
    icon: Landmark,
    href: "/study-options#india",
    cta: "Explore India options",
    pale: "var(--surface-soft-amber)",
    strong: "var(--surface-soft-amber-strong)",
    buttonVariant: "outline" as const,
  },
];

export function StudyPathwaysSection() {
  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2">
        {PATHWAY_PRESENTATION.map(({ pathway, icon: Icon, href, cta, pale, strong, buttonVariant }) => {
          if (!pathway) return null;
          return (
            <Card
              key={pathway.id}
              className="flex h-full flex-col rounded-[20px]"
              style={{ borderTopWidth: "3px", borderTopColor: strong }}
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-full"
                style={{ backgroundColor: pale, color: strong }}
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-xl font-bold text-text">Study in {pathway.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{pathway.summary}</p>
              <ul className="mt-4 flex-1 space-y-2.5">
                {pathway.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm text-text-soft">
                    <CircleCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                    {point}
                  </li>
                ))}
              </ul>
              <LinkButton href={href} variant={buttonVariant} size="lg" className="mt-6 w-full justify-center font-semibold">
                {cta}
              </LinkButton>
            </Card>
          );
        })}
      </div>
      <DemoNotice className="mt-6">
        Costs, visa rules and requirements vary by country and change over time — always confirm current details
        during counselling or on our full{" "}
        <Link href="/study-options" className="underline underline-offset-2">
          Study Options
        </Link>{" "}
        comparison.
      </DemoNotice>
    </div>
  );
}
