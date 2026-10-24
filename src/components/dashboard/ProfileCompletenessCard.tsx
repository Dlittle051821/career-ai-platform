import Link from "next/link";
import { ArrowRight, Check, FileText } from "lucide-react";
import type { CompletionResult } from "@/types/student-profile";

/**
 * UX10-D01 — "Profile Completeness".
 *
 * `completion` is the real, already-computed `calculateCompletion()`
 * result (src/lib/profile/completion.ts) — the real percent and the real
 * ~10-section list, never the reference mockup's own six example
 * category names. When `sections` is empty (profile not started —
 * `getStudentProfileSnapshot()` returned null), a locked/empty state is
 * shown instead of a fabricated 0%-complete checklist.
 */
/**
 * NW01 Part C — pure, directly-testable "what does this percent honestly
 * say?" logic, pulled out of the JSX below so a unit test can cover every
 * boundary (0 / partial / >=75 / 100) without needing a React rendering
 * harness (this repo has none today — see journey-progress.ts/
 * next-best-action.ts for the same "pure logic, thin UI on top" pattern).
 * The confirmed defect this replaces: `percent >= 75 ? "Almost there!" :
 * ...` kept showing "Almost there!" even once percent genuinely reached
 * 100.
 */
export function profileCompletenessMessage(percent: number): { heading: string; subcopy: string } {
  if (percent >= 100) {
    return {
      heading: "Your profile is complete!",
      subcopy: "Every required section is filled in — your recommendations reflect your full profile.",
    };
  }
  return {
    heading: percent >= 75 ? "Almost there!" : percent > 0 ? "Keep going — every section helps." : "Let's get started.",
    subcopy: "Complete the remaining sections for more accurate recommendations.",
  };
}

export function ProfileCompletenessCard({ completion }: { completion: CompletionResult }) {
  const { percent, sections, status } = completion;
  const requiredSections = sections.filter((s) => s.required);

  if (status === "not_started" && requiredSections.length === 0) {
    return (
      <section aria-labelledby="profile-completeness-heading" className="flex h-full flex-col rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft sm:p-7">
        <CardHeader />
        <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-alt text-muted">
            <FileText aria-hidden="true" className="h-5 w-5" />
          </span>
          <p className="max-w-xs text-sm text-muted">
            Complete your profile to unlock personalised recommendations and a clearer picture of where you stand.
          </p>
          <Link href="/profile/onboarding" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-light">
            Start my profile
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </section>
    );
  }

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
    <section aria-labelledby="profile-completeness-heading" className="flex h-full flex-col rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft sm:p-7">
      <CardHeader />

      <div className="mt-6 flex flex-1 flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div
          className="relative h-28 w-28 shrink-0"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Profile completion"
        >
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-border)" strokeWidth="9" />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-sans text-xl font-semibold text-text">{percent}%</span>
        </div>

        <div className="min-w-0 flex-1">
          {/*
            NW01 Part C — see profileCompletenessMessage() above:
            `calculateCompletion()` (src/lib/profile/completion.ts) only
            ever derives `percent` from REQUIRED sections — the optional
            "Experience" section (weight 0) can never hold it below 100, so
            percent === 100 here always means every required section is
            genuinely done; no second completion calculator was introduced,
            this is still the one real percent.
          */}
          <p className="text-sm font-semibold text-text">{profileCompletenessMessage(percent).heading}</p>
          <p className="mt-1 text-xs text-muted">{profileCompletenessMessage(percent).subcopy}</p>
          <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {requiredSections.map((section) => (
              <li key={section.key} className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className={
                    section.complete
                      ? "flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-white"
                      : "h-4 w-4 shrink-0 rounded-full border-2 border-border-strong"
                  }
                >
                  {section.complete ? <Check className="h-2.5 w-2.5" /> : null}
                </span>
                <span className={section.complete ? "text-text" : "text-muted"}>
                  {section.label}
                  <span className="sr-only">{section.complete ? " — complete" : " — not yet complete"}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function CardHeader() {
  return (
    <div className="flex items-start justify-between gap-3">
      <h2 id="profile-completeness-heading" className="font-sans text-lg font-semibold text-text">
        Profile Completeness
      </h2>
      <Link href="/profile" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:text-primary-light">
        View Profile
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
