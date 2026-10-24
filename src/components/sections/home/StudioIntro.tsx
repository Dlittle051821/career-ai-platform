import { ArrowRight, Check, Compass, LayoutGrid, Plane } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { LinkButton } from "@/components/ui/Button";
import { FADE_UP_CLASSES, HOVER_LIFT_CLASSES } from "@/lib/ui/motion";
import { HOMEPAGE_CONTAINER_CLASSNAME } from "./homepage-layout";
import { cn } from "@/lib/utils";

/**
 * NW04.2 — Homepage, "Student Studio" introduction section.
 *
 * Introduces the shared authenticated hub (/studio, built in NW03.3) to a
 * public visitor: one account, two independent product workspaces. The
 * approved NW04 reference image's own version of this panel shows a
 * fabricated "My Workspace" preview — a named student ("Aarav Sharma"),
 * an avatar, and specific saved-item counts ("3 saved items", "2 saved
 * items"). None of that is real for an anonymous homepage visitor, and
 * this milestone's brief is explicit: "DO NOT copy fictional student
 * information, fabricated account metrics... into the real website." The
 * decorative panel below keeps the reference's two-workspace-tile IDEA
 * (Career / Abroad, side by side, inside one dark panel) but drops every
 * fabricated specific — no name, no avatar, no counts — the same
 * discipline already applied throughout src/app/studio/abroad/page.tsx
 * (NW03.3) for exactly this reason.
 *
 * The three checklist lines below are each a real, already-shipped fact
 * (one Supabase Auth account; /studio/career and /studio/abroad as
 * separate routes; saved items already spanning both products via
 * src/lib/supabase/education/saved-items.ts) — not marketing promises.
 */
const CHECKLIST = ["Single login for both products", "Separate workspaces, shared profile", "Save, compare, and plan across both"];

export function StudioIntro() {
  return (
    <Section tone="muted" containerClassName={HOMEPAGE_CONTAINER_CLASSNAME} className="!py-10 sm:!py-12 lg:!py-16">
      <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
        <div className={FADE_UP_CLASSES}>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-secondary-dark">
            <span aria-hidden="true" className="h-px w-6 bg-secondary" />
            Student Studio
          </p>
          <h2 className="text-2xl font-semibold text-primary sm:text-3xl">One account. Two workspaces.</h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted sm:text-base">
            Your personalised space to explore, plan, and track your journey — whether it&apos;s career discovery in
            India, your study-abroad plans, or both.
          </p>

          <ul className="mt-6 space-y-3">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm font-medium text-text">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
                  <Check aria-hidden="true" className="h-3 w-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>

          <LinkButton
            href="/register?next=/studio"
            size="lg"
            className={cn("mt-7", HOVER_LIFT_CLASSES)}
            trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}
          >
            Create Your Free Account
          </LinkButton>
        </div>

        <div className={cn("relative", FADE_UP_CLASSES)} style={{ animationDelay: "90ms" }}>
          <div className="rounded-[1.75rem] bg-[var(--brand-ink)] p-6 shadow-lifted sm:p-7">
            <div className="flex items-center gap-2 text-on-primary-muted">
              <LayoutGrid aria-hidden="true" className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">My Studio</span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/[0.06] p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-intelligence">
                  <Compass aria-hidden="true" className="h-4.5 w-4.5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-on-primary">Career Workspace</p>
                <p className="mt-1 text-xs leading-relaxed text-on-primary-muted">Discovery, courses &amp; colleges</p>
              </div>
              <div className="rounded-2xl bg-white/[0.06] p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-intelligence">
                  <Plane aria-hidden="true" className="h-4.5 w-4.5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-on-primary">Abroad Workspace</p>
                <p className="mt-1 text-xs leading-relaxed text-on-primary-muted">Destinations &amp; programmes</p>
              </div>
            </div>

            <p className="mt-5 text-xs leading-relaxed text-on-primary-muted">
              Illustrative preview — your own Studio fills in with your real saved items once you create an account.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
