import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { FADE_UP_CLASSES } from "@/lib/ui/motion";
import { cn } from "@/lib/utils";

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  children?: ReactNode;
  /**
   * UX09 Part B — optional decorative header art (e.g. a `<NetworkGraphic
   * accessibility={{ kind: "decorative" }} />`), rendered beside the
   * title on desktop. Entirely additive: every one of this component's
   * 16 pre-UX09 call sites (payments, legal, contact, pricing, etc.)
   * keeps rendering exactly as before by simply not passing it — this
   * pass only adds the prop to the two call sites the task actually
   * named (career-discovery; careers/courses/universities build their
   * own header markup directly rather than through this component).
   */
  visual?: ReactNode;
}

/** Shared inner-page hero: breadcrumbs + H1 + intro copy, optionally extended with children. */
export function PageHero({ eyebrow, title, description, breadcrumbs, children, visual }: PageHeroProps) {
  const hasVisual = Boolean(visual);
  return (
    <Section
      tone="muted"
      className={cn("pt-10 sm:pt-14 pb-12 sm:pb-16", hasVisual && "relative overflow-hidden")}
    >
      {/* UX09 Part B — these two class lists are mutually exclusive, never
          combined: `space-y-6` (margin-top between stacked children) and
          `grid gap-8` (grid's own gap) both control vertical/horizontal
          spacing between the same two children, and applying both at once
          would double up the gap and misalign the visual column against
          the text column once `lg:grid-cols-[1fr_auto]` puts them side by
          side. */}
      <div className={hasVisual ? "grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12" : "space-y-6"}>
        <div className={hasVisual ? "space-y-6" : undefined}>
          {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
          <div className={cn("max-w-3xl", hasVisual && FADE_UP_CLASSES)}>
            {eyebrow ? <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-secondary">{eyebrow}</p> : null}
            <h1 className="text-4xl sm:text-5xl font-semibold text-primary balance">{title}</h1>
            {description ? <p className="mt-5 text-lg text-muted leading-relaxed">{description}</p> : null}
          </div>
          {children}
        </div>
        {hasVisual ? <div className="hidden lg:block">{visual}</div> : null}
      </div>
    </Section>
  );
}
