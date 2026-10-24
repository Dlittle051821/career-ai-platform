import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardList, Globe2, Sparkles } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { DemoNotice } from "@/components/ui/DemoNotice";

export const metadata: Metadata = {
  title: "Study Abroad Workspace",
  robots: { index: false, follow: false },
};

/**
 * NW03.3 — `/studio/abroad`, the authenticated Abroad workspace.
 *
 * Unlike `/studio/career` (which redirects to the existing, fully-built
 * `/dashboard`), there is no existing Abroad-specific authenticated
 * workspace to reuse — NW02 built a public, unauthenticated Country
 * Explorer (`/study-europe`) but no signed-in Abroad application-tracking
 * or recommendation feature exists yet in this codebase.
 *
 * Per the audit's explicit finding (NW03_01_AUDIT.md section 3) and this
 * codebase's own repeated "never fabricate a signal the product doesn't
 * actually record" discipline (see src/lib/dashboard/journey-progress.ts's
 * docblock), this page does not invent application counts, a fake progress
 * bar, or placeholder recommendations. It links out to the real, working
 * Abroad research tools that already exist, and uses the existing
 * `ComingSoon` / `DemoNotice` primitives — already used elsewhere in this
 * codebase for exactly this situation — to honestly label what is not
 * built yet, rather than simulating it.
 */
export default function StudioAbroadPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary sm:text-3xl">Study Abroad</h1>
        <p className="mt-2 text-base text-muted">
          Research and plan your study-abroad journey across six European countries — fully usable on its own.
        </p>
      </div>

      <DemoNotice>
        This workspace is in its foundation stage: country and course research below are real and fully working.
        Application tracking and Abroad-specific recommendations are not built yet — see the sections below for
        what&apos;s coming.
      </DemoNotice>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
            <Globe2 aria-hidden="true" className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-primary">Country Explorer</h2>
          <p className="flex-1 text-sm leading-relaxed text-muted">
            Compare Germany, Ireland, Netherlands, France, Sweden, and Denmark on tuition, English-taught
            programmes, admissions, and post-study options.
          </p>
          <LinkButton href="/study-europe" variant="outline" trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
            Open Country Explorer
          </LinkButton>
        </div>

        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
            <Sparkles aria-hidden="true" className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-primary">Courses & universities</h2>
          <p className="flex-1 text-sm leading-relaxed text-muted">
            Search and save universities and courses across all seven launch destinations, including your six
            Abroad countries.
          </p>
          <LinkButton href="/courses" variant="outline" trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
            Find courses
          </LinkButton>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <ComingSoon
          title="Abroad application tracking"
          description="Track application status for each university you apply to abroad, in one place."
        />
        <ComingSoon
          title="Abroad recommendations"
          description="Personalised country and course suggestions, based on your saved items and goals."
          className="flex-col items-start"
        />
      </div>

      <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface-alt p-5">
        <ClipboardList aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
        <p className="text-sm leading-relaxed text-text-soft">
          <span className="font-semibold text-primary">Also considering a career path in India? </span>
          That&apos;s a separate workspace —{" "}
          <Link href="/studio/career" className="font-medium text-secondary-dark underline underline-offset-2">
            open Career Intelligence
          </Link>
          . Using this workspace never requires it.
        </p>
      </div>
    </div>
  );
}
