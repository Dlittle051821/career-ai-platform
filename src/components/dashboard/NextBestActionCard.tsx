import Image from "next/image";
import { ArrowRight, Target } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import type { NextBestAction } from "@/lib/dashboard/next-best-action";

/**
 * UX10-D01 — "Your Next Best Action".
 *
 * The action itself (title/description/href/cta) is `getNextBestAction()`'s
 * real output, unchanged — see src/lib/dashboard/next-best-action.ts. The
 * reference mockup also shows a "Takes about N minutes" estimate; this
 * product's next-best-action logic has no real per-action duration
 * estimate to show, and inventing one would be exactly the kind of
 * fabricated data this milestone's brief forbids, so it is simply omitted
 * rather than guessed.
 */
export function NextBestActionCard({ action }: { action: NextBestAction }) {
  return (
    <section
      aria-labelledby="next-action-heading"
      className="relative overflow-hidden rounded-[1.5rem] border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-surface to-surface p-5 shadow-soft sm:p-7"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Target aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="inline-flex items-center rounded-full bg-accent-light px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-accent-dark">
              Recommended
            </span>
          </div>
          <h2 id="next-action-heading" className="mt-3 font-sans text-xl font-semibold text-text balance">
            {action.title}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{action.description}</p>
          {/* UX10-M01 — the dashboard's single most-prominent CTA; LinkButton
              shrinks to its text by default, so make it a full-width,
              thumb-friendly primary action on mobile only. */}
          <LinkButton
            href={action.href}
            size="md"
            className="mt-5 w-full sm:w-auto"
            trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}
          >
            {action.cta}
          </LinkButton>
        </div>

        <div className="relative mx-auto h-40 w-40 shrink-0 sm:h-48 sm:w-48">
          <div aria-hidden="true" className="absolute inset-0 rounded-full bg-gradient-to-br from-intelligence-light to-primary/10" />
          <Image
            src="/dashboard/student-next-action.png"
            alt=""
            aria-hidden="true"
            fill
            sizes="192px"
            className="object-contain object-bottom"
          />
        </div>
      </div>
    </section>
  );
}
