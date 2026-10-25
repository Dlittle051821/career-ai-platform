import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BUDGET_BAND_OPTIONS } from "@/data/profile-options";
import type { BudgetBand, ProfileStatus } from "@/types/student-profile";

export interface AbroadReadinessCardProps {
  profilePercent: number;
  profileStatus: ProfileStatus;
  /** Real EUROPE_COUNTRIES names the student has already selected as a preferred study destination — see src/lib/abroad/scope.ts. */
  destinationPreferences: string[];
  budgetBand: BudgetBand | null;
  savedAbroadItemCount: number;
}

const BUDGET_BAND_LABELS: Record<BudgetBand, string> = Object.fromEntries(
  BUDGET_BAND_OPTIONS.map((o) => [o.key, o.label])
) as Record<BudgetBand, string>;

/**
 * NW05.5 — "Abroad Readiness".
 *
 * Six rows, matching the brief's suggested readiness dimensions (academic
 * info, destination preference, language test planning, budget planning,
 * document planning, programme shortlist) — but only the first, second,
 * fourth, and sixth are backed by a real signal this product records
 * today. Language test planning and document planning are explicitly
 * marked "Not yet tracked" rather than given a fabricated status, per the
 * brief's own instruction not to simulate a tool that doesn't exist, and
 * per this codebase's repeated "never fabricate a signal the product
 * doesn't actually record" discipline (see src/lib/dashboard/
 * journey-progress.ts's docblock for the same principle applied
 * elsewhere). None of these six rows is ever treated as a pass/fail
 * eligibility gate — a missing optional field is shown as "not shared
 * yet", never as a disqualification, and no visa/admission eligibility is
 * derived from any of them (the brief explicitly forbids deriving that
 * without authoritative criteria this product does not have).
 */
export function AbroadReadinessCard({
  profilePercent,
  profileStatus,
  destinationPreferences,
  budgetBand,
  savedAbroadItemCount,
}: AbroadReadinessCardProps) {
  const rows: Array<{ key: string; label: string; value: string; href: string; tracked: boolean }> = [
    {
      key: "academic",
      label: "Academic profile",
      value: profileStatus === "not_started" ? "Not started" : `${profilePercent}% complete`,
      href: "/profile",
      tracked: true,
    },
    {
      key: "destination",
      label: "Destination preference",
      value: destinationPreferences.length > 0 ? destinationPreferences.join(", ") : "Not shared yet",
      href: "/profile/onboarding",
      tracked: true,
    },
    {
      key: "language",
      label: "Language test planning",
      value: "Not yet tracked",
      href: "/discovery-session/book",
      tracked: false,
    },
    {
      key: "budget",
      label: "Budget planning",
      value: budgetBand ? BUDGET_BAND_LABELS[budgetBand] : "Not shared yet",
      href: "/profile/onboarding",
      tracked: true,
    },
    {
      key: "documents",
      label: "Document planning",
      value: "Not yet tracked",
      href: "/discovery-session/book",
      tracked: false,
    },
    {
      key: "shortlist",
      label: "Programme shortlist",
      value: savedAbroadItemCount === 0 ? "No saved items yet" : `${savedAbroadItemCount} saved`,
      href: "/saved",
      tracked: true,
    },
  ];

  return (
    <section aria-labelledby="abroad-readiness-heading" className="rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft sm:p-7">
      <h2 id="abroad-readiness-heading" className="font-sans text-lg font-semibold text-text">
        Abroad Readiness
      </h2>
      <p className="mt-1 text-sm text-muted">
        A real snapshot of what we know so far — nothing here blocks you, and a blank field is never treated as a disqualification.
      </p>

      <dl className="mt-5 divide-y divide-border">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4 py-3">
            <dt className="text-sm text-muted">{row.label}</dt>
            <dd className="flex items-center gap-2 text-right text-sm font-medium text-text">
              <span className={row.tracked ? undefined : "italic text-muted"}>{row.value}</span>
              <Link href={row.href} aria-label={`${row.tracked ? "Update" : "Talk to a counsellor about"} ${row.label.toLowerCase()}`} className="text-secondary-dark hover:text-secondary">
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
