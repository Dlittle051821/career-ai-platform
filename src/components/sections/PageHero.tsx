import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";

/**
 * CIUX-01B — the shared first screen of every public page (styled by
 * src/styles/page-hero.css). It speaks the homepage's visual language — the
 * hero's paper light, Space Grotesk headline (navy statement, Ocean
 * resolution), the tracked eyebrow with the cyan dot, the hero's two buttons
 * — and runs up behind the floating global header. The homepage keeps its
 * own cinematic introduction; every other page uses this.
 *
 * Variation is by content, not by design: copy, actions, `align`
 * (start | center), `size` (standard for journey pages; compact for
 * listings, legal and account pages) and an optional `visual`. Entrance is
 * one short staggered rise (CSS only; off under reduced motion).
 *
 * Backwards compatible with the UX09/CIUX-01 API (eyebrow, title,
 * description, breadcrumbs, children, visual), so every existing caller now
 * renders in the new design without change.
 */
export type HeroAction = { href: string; label: string; icon?: ReactNode };
export type HeroPoint = { icon: LucideIcon; label: string };

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  /** a second headline line in Ocean (the homepage's "statement / resolution" pairing) */
  titleAccent?: string;
  description?: ReactNode;
  breadcrumbs?: Crumb[];
  primaryAction?: HeroAction;
  secondaryAction?: HeroAction;
  points?: HeroPoint[];
  /** extra content below the copy (filters, notices, a sign-in hint) */
  children?: ReactNode;
  /** optional illustration or interactive panel, beside the copy from 1024 px */
  visual?: ReactNode;
  align?: "start" | "center";
  size?: "standard" | "compact";
  /** the tone of the section that follows, so the hero's foot settles into it (default white) */
  fadeTo?: "white" | "muted";
  id?: string;
}

export function PageHero({
  eyebrow,
  title,
  titleAccent,
  description,
  breadcrumbs,
  primaryAction,
  secondaryAction,
  points,
  children,
  visual,
  align = "start",
  size = "standard",
  fadeTo = "white",
  id,
}: PageHeroProps) {
  let i = 0;
  const rise = () => ({ "data-rise": "", style: { "--rise": i++ } as CSSProperties });

  return (
    <section className="nw-hero" data-align={align} data-size={size} data-fade={fadeTo} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="nw-hero-inner">
        <div className="nw-hero-grid" data-visual={visual ? "" : undefined}>
          <div className="nw-hero-copy">
            {breadcrumbs ? (
              <div className="nw-hero-crumbs" {...rise()}>
                <Breadcrumbs items={breadcrumbs} />
              </div>
            ) : null}
            {eyebrow ? (
              <p className="nw-hero-eyebrow" {...rise()}>
                {eyebrow}
              </p>
            ) : null}
            <h1 id={id ? `${id}-title` : undefined} className="nw-hero-title" {...rise()}>
              {title}
              {titleAccent ? <span className="nw-hero-accent"> {titleAccent}</span> : null}
            </h1>
            {description ? (
              <p className="nw-hero-lead" {...rise()}>
                {description}
              </p>
            ) : null}
            {primaryAction || secondaryAction ? (
              <div className="nw-hero-actions" {...rise()}>
                {primaryAction ? (
                  <Link href={primaryAction.href} className="nw-hero-btn" data-kind="primary">
                    {primaryAction.label}
                    <span className="nw-hero-arrow" aria-hidden="true">
                      <ArrowRight />
                    </span>
                  </Link>
                ) : null}
                {secondaryAction ? (
                  <Link href={secondaryAction.href} className="nw-hero-btn" data-kind="secondary">
                    {secondaryAction.icon}
                    {secondaryAction.label}
                  </Link>
                ) : null}
              </div>
            ) : null}
            {points?.length ? (
              <ul className="nw-hero-points" {...rise()}>
                {points.map(({ icon: Icon, label }) => (
                  <li key={label}>
                    <Icon aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            ) : null}
            {children ? (
              <div className="nw-hero-extra" {...rise()}>
                {children}
              </div>
            ) : null}
          </div>
          {visual ? (
            <div className="nw-hero-visual" {...rise()}>
              {visual}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export type HeroStep = { icon: LucideIcon; title: string; text: string; tag?: string; href?: string; focus?: boolean };

/**
 * The page-hero visual used across pages: a calm card of steps or topics,
 * each with an icon chip; one step can carry the coral focus. Content comes
 * from the page, so the card says something true about that page.
 * Decorative ordering only — every link in it is a real route.
 */
export function HeroStepsCard({ title, steps, label }: { title?: string; steps: HeroStep[]; label: string }) {
  return (
    <div className="nw-hero-card" role="group" aria-label={label}>
      {title ? <p className="nw-hero-card-title">{title}</p> : null}
      <ol className="nw-hero-steps">
        {steps.map((step) => {
          const Icon = step.icon;
          const body = (
            <>
              <span className="nw-hero-step-icon" aria-hidden="true">
                <Icon />
              </span>
              <span>
                <span className="nw-hero-step-title">{step.title}</span>
                <span className="nw-hero-step-text">{step.text}</span>
              </span>
              {step.tag ? <span className="nw-hero-step-tag">{step.tag}</span> : null}
            </>
          );
          return (
            <li key={step.title}>
              {step.href ? (
                <Link href={step.href} className="nw-hero-step" data-focus={step.focus ? "" : undefined}>
                  {body}
                </Link>
              ) : (
                <div className="nw-hero-step" data-focus={step.focus ? "" : undefined}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
