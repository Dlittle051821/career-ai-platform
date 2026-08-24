import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  children?: ReactNode;
}

/** Shared inner-page hero: breadcrumbs + H1 + intro copy, optionally extended with children. */
export function PageHero({ eyebrow, title, description, breadcrumbs, children }: PageHeroProps) {
  return (
    <Section tone="muted" className="pt-10 sm:pt-14 pb-12 sm:pb-16">
      <div className="space-y-6">
        {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
        <div className="max-w-3xl">
          {eyebrow ? <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-secondary">{eyebrow}</p> : null}
          <h1 className="text-4xl sm:text-5xl font-semibold text-primary balance">{title}</h1>
          {description ? <p className="mt-5 text-lg text-muted leading-relaxed">{description}</p> : null}
        </div>
        {children}
      </div>
    </Section>
  );
}
