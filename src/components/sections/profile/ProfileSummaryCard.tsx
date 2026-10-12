import { Calendar, CheckCircle2, Mail, MapPin, Sparkles } from "lucide-react";
import type { CompletionResult } from "@/types/student-profile";
import type { RecommendationReadiness } from "@/types/recommendation-readiness";
import { cn } from "@/lib/utils";

/**
 * UX10-P01 — the profile summary card sitting between the page header and
 * the 3-column workspace. Every value here is real:
 *  - name/email come from `getCurrentProfile()` (the real `profiles` row —
 *    the same source `/dashboard`'s greeting and UserMenu already use).
 *  - location comes from the real Student Digital Profile (`city`/`state`/
 *    `country`).
 *  - the completion ring is `calculateCompletion()`'s real percent — the
 *    exact same function/number the dashboard's own Profile Completeness
 *    card and the onboarding wizard's progress bar already use, so this
 *    page can never show a different number than the dashboard (brief
 *    section 20's explicit requirement).
 *  - the readiness badge is the real `career` recommendation readiness
 *    from `getMyRecommendationReadiness()` — never a hardcoded "Ready".
 *
 * There is no avatar/photo field anywhere on this product's `Profile`
 * type, so the avatar is an initials badge — the same honest
 * substitution `DashboardShell`'s `UserMenu` already uses, not a
 * generated illustration presented as the student's real photo (the
 * brief's own explicit instruction, section 16).
 */

function initialsFor(name: string | null, email: string | null): string {
  const source = name ?? email ?? "S";
  return (
    source
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "S"
  );
}

function formatJoinDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `Joined ${date.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
}

function readinessCopy(readiness: RecommendationReadiness | null): { label: string; tone: "ready" | "preliminary" | "not_ready" } {
  if (!readiness) return { label: "Complete your profile to check readiness", tone: "not_ready" };
  if (readiness.level === "READY" || readiness.level === "COUNSELLOR_VERIFIED") {
    return { label: "Ready for Recommendations", tone: "ready" };
  }
  if (readiness.level === "PRELIMINARY") {
    return { label: "Almost ready for recommendations", tone: "preliminary" };
  }
  return { label: "Complete more sections to get started", tone: "not_ready" };
}

export function ProfileSummaryCard({
  fullName,
  email,
  city,
  state,
  country,
  joinedAt,
  bioText,
  completion,
  careerReadiness,
}: {
  fullName: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  country: string;
  joinedAt: string | null;
  bioText: string | null;
  completion: CompletionResult;
  careerReadiness: RecommendationReadiness | null;
}) {
  const displayName = fullName ?? "Student";
  const location = [city, state, country].filter(Boolean).join(", ");
  const joinLabel = formatJoinDate(joinedAt);
  const { label: readyLabel, tone } = readinessCopy(careerReadiness);

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - completion.percent / 100);

  return (
    <section
      aria-labelledby="profile-summary-heading"
      className="relative z-10 -mt-10 rounded-[1.5rem] border border-border bg-surface p-5 shadow-lifted sm:-mt-14 sm:p-7"
    >
      <h2 id="profile-summary-heading" className="sr-only">
        Profile summary
      </h2>
      {/* UX10-D01 learned this lesson the hard way (its own Profile
          Completeness/Next Best Action row): a two-way split needs to
          activate only where there's genuinely enough width. At `lg:`
          (1024px, where the 2-column nav+form layout below already
          starts) this card's name/ring/readiness-badge row was too
          cramped — the name truncated and the badge text wrapped
          awkwardly. Gating the row layout at `xl:` instead (matching the
          3-column workspace grid's own breakpoint) keeps this card
          comfortably stacked at 1024, within the brief's own "cards may
          stack at 1024" allowance. */}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-on-primary shadow-soft sm:h-20 sm:w-20 sm:text-2xl"
          >
            {initialsFor(fullName, email)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-sans text-xl font-semibold text-text sm:text-2xl">{displayName}</p>
              <span className="shrink-0 rounded-full bg-secondary-light px-2.5 py-0.5 text-xs font-semibold text-secondary-dark">
                Student
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              {email ? (
                <span className="inline-flex items-center gap-1.5">
                  <Mail aria-hidden="true" className="h-3.5 w-3.5" />
                  {email}
                </span>
              ) : null}
              {location ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                  {location}
                </span>
              ) : null}
              {joinLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar aria-hidden="true" className="h-3.5 w-3.5" />
                  {joinLabel}
                </span>
              ) : null}
            </div>
            {bioText ? <p className="mt-2 max-w-xl text-sm italic text-text-soft">&ldquo;{bioText}&rdquo;</p> : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-4 sm:gap-6">
          <div
            className="relative h-20 w-20 shrink-0 sm:h-24 sm:w-24"
            role="progressbar"
            aria-valuenow={completion.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completion"
          >
            <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
              <circle cx="44" cy="44" r={radius} fill="none" stroke="var(--color-border)" strokeWidth="8" />
              <circle
                cx="44"
                cy="44"
                r={radius}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-sans text-lg font-semibold text-text sm:text-xl">{completion.percent}%</span>
            </span>
          </div>
          <p className="w-16 text-center text-xs leading-tight text-muted sm:w-20">Profile Complete</p>

          <div
            className={cn(
              "flex max-w-[220px] items-start gap-2.5 rounded-2xl border px-4 py-3",
              tone === "ready" && "border-success/25 bg-success-light",
              tone === "preliminary" && "border-secondary/25 bg-secondary-light",
              tone === "not_ready" && "border-border bg-surface-alt"
            )}
          >
            {tone === "ready" ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            ) : (
              <Sparkles aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-secondary-dark" />
            )}
            <div>
              <p className="text-sm font-semibold text-text">{readyLabel}</p>
              <p className="mt-0.5 text-xs text-muted">
                {tone === "ready"
                  ? "Your career recommendations reflect your full profile."
                  : "Complete remaining sections to unlock more precise matches."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
