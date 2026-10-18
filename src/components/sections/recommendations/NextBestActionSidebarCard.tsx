import { ArrowRight, Target } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import type { NextBestAction } from "@/lib/dashboard/next-best-action";

/**
 * UX10-REC01 — a compact "Your Next Best Action" card for the narrow
 * right-hand sidebar, matching the reference mockup's sidebar placement.
 *
 * The shared `NextBestActionCard` (`src/components/dashboard/
 * NextBestActionCard.tsx`, reused unmodified elsewhere on this page's
 * Overview/Next Steps tabs) is laid out `sm:flex-row` with a 192px
 * illustration — correct for the wide contexts it was built for
 * (`/dashboard`, and this page's own full-width tab panels), but it does
 * not fit a ~22rem sidebar column: at any viewport past the `sm:`
 * breakpoint the image+text row has no room, and the title wraps into
 * the card below it. Rather than modify that shared real component just
 * to fit one atypically narrow placement, this is a second, deliberately
 * simple presentation of the exact same real `action` data (no
 * illustration, no second decision logic) — see
 * `UX10-REC01_REFERENCE_AUDIT.md` section 10 for the full writeup.
 */
export function NextBestActionSidebarCard({ action }: { action: NextBestAction }) {
  return (
    <section
      aria-labelledby="next-action-sidebar-heading"
      className="rounded-[1.5rem] border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-surface to-surface p-5 shadow-soft"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Target aria-hidden="true" className="h-4.5 w-4.5" />
        </span>
        <span className="inline-flex items-center rounded-full bg-accent-light px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-accent-dark">
          Recommended
        </span>
      </div>
      <h2 id="next-action-sidebar-heading" className="mt-3 font-sans text-base font-semibold text-text">
        {action.title}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{action.description}</p>
      <LinkButton href={action.href} size="sm" className="mt-4 w-full" trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
        {action.cta}
      </LinkButton>
    </section>
  );
}
