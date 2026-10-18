import Link from "next/link";
import { Mail, MapPin, TrendingUp } from "lucide-react";
import type { CompletionResult } from "@/types/student-profile";

/**
 * UX10-REC01 — "Profile at a Glance" sidebar card. Every row is a real,
 * already-fetched field — name/email from `getCurrentProfile()`, location
 * from the real Student Digital Profile, and `completion` from
 * `calculateCompletion()`, the exact same function/number `/profile` and
 * `/dashboard` already use (brief section 15's "max 4-6 rows, no
 * sensitive/admin/counsellor-only data" and section 30's "no duplicate
 * state" requirements). No avatar/photo field exists on this product's
 * `Profile` type, so this reuses the same honest initials-badge
 * substitution `DashboardShell`'s `UserMenu` and `ProfileSummaryCard`
 * already use rather than a stand-in illustration.
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

export function ProfileAtAGlanceCard({
  fullName,
  email,
  city,
  state,
  country,
  completion,
}: {
  fullName: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  country: string;
  completion: CompletionResult;
}) {
  const displayName = fullName ?? "Student";
  const location = [city, state, country].filter(Boolean).join(", ");

  return (
    <section aria-labelledby="profile-glance-heading" className="rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 id="profile-glance-heading" className="font-sans text-base font-semibold text-text">
          Profile at a Glance
        </h2>
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary"
        >
          {initialsFor(fullName, email)}
        </span>
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">Name</dt>
          <dd className="truncate font-medium text-text">{displayName}</dd>
        </div>
        {email ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-muted">
              <Mail aria-hidden="true" className="h-3.5 w-3.5" /> Email
            </dt>
            <dd className="truncate font-medium text-text">{email}</dd>
          </div>
        ) : null}
        {location ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-muted">
              <MapPin aria-hidden="true" className="h-3.5 w-3.5" /> Location
            </dt>
            <dd className="truncate font-medium text-text">{location}</dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-muted">
            <TrendingUp aria-hidden="true" className="h-3.5 w-3.5" /> Profile complete
          </dt>
          <dd className="font-medium text-text">{completion.percent}%</dd>
        </div>
      </dl>

      <Link href="/profile" className="mt-4 inline-block text-sm font-medium text-primary hover:text-primary-light">
        View full profile
      </Link>
    </section>
  );
}
