import { ExternalLink, ShieldAlert, Globe2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { CONTINUE_ON_OFFICIAL_SOURCE_LABEL, EXTERNAL_LINK_BADGE_LABEL, TRUSTED_NATIONAL_SOURCE_LABEL, TRUSTED_SOURCE_ATTRIBUTION_LABEL } from "@/lib/education/external-search/attribution";
import { isLaunchPrimaryResult } from "@/lib/education/external-search/launch-primary-result";
import { getLaunchCountryPrimarySource } from "@/lib/education/external-search/launch-country-sources";
import type { AdapterResult } from "@/lib/education/external-search/provider-types";

/**
 * "Trusted external search" result card — the spec's own external-portal
 * card, deliberately visually distinct from CourseCard (internal NextWise
 * programme results) so it can never be mistaken for a NextWise-owned
 * course. Uses `--brand-ink`/near-black for its header (spec: "Near Black
 * for serious and data-heavy information" — an authoritative,
 * institutional tone that is visually unlike the lime `--brand-signal`
 * used to emphasize an internal match) and `--brand-coral`/`--brand-coral-pale`
 * for its warning banner (spec: "Warm Coral for warnings and stale-data
 * notices").
 *
 * Every clickable link on this card goes through the internal
 * /go/course-search/** redirect route, NEVER directly to `result.url` —
 * that route re-validates the destination server-side right before
 * redirecting (defense in depth) and is the only place an outbound click
 * is ever recorded. See src/app/go/course-search/[mappingId]/route.ts.
 */
export function TrustedExternalSearchCard({ result }: { result: AdapterResult }) {
  const goHref = result.isFiltered && result.mappingId ? `/go/course-search/${result.mappingId}` : `/go/course-search/provider/${result.providerId}`;
  const announcementId = `trusted-portal-${result.providerId}`;
  // M20B — Trusted Country Source Operational Integration: for a launch
  // country's M20A-registry primary source specifically, the eyebrow label
  // below uses M20A's own approved attribution wording ("Official study
  // source") instead of this card's pre-existing generic "Official
  // external portal" label — every other provider (every non-launch-
  // country result, and every launch country's non-primary specialist
  // provider, e.g. UCAS/NCES/EduCanada/CRICOS/CAO) keeps the original
  // wording unchanged. See src/lib/education/external-search/
  // launch-primary-result.ts and attribution.ts.
  const isLaunchPrimary = isLaunchPrimaryResult(result, result.countryCode);
  const eyebrowLabel = isLaunchPrimary ? TRUSTED_SOURCE_ATTRIBUTION_LABEL : "Official external portal";
  // M20C — Trusted Country Discovery UX: for a launch country's primary
  // source specifically, surface M20A's own already-approved, hand-written
  // `purpose` text as a short description (never fabricated here — this
  // card never invents its own copy about a provider) and the
  // `TRUSTED_NATIONAL_SOURCE_LABEL` badge, so it reads as visibly distinct
  // from a coexisting non-primary specialist provider for the same country
  // (e.g. UCAS for GB) without replacing or hiding that specialist result.
  const primarySource = isLaunchPrimary ? getLaunchCountryPrimarySource(result.countryCode) : null;

  return (
    <article
      className="overflow-hidden rounded-[var(--radius-card)] border-2 border-[var(--brand-ink)] bg-surface"
      aria-labelledby={`${announcementId}-heading`}
    >
      <div className="flex items-center justify-between gap-3 px-5 py-3 text-white" style={{ backgroundColor: "var(--brand-ink)" }}>
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          <Globe2 aria-hidden="true" className="h-4 w-4" />
          {eyebrowLabel}
        </span>
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium">
          {EXTERNAL_LINK_BADGE_LABEL} · {result.officialDomain}
        </span>
      </div>

      <div className="p-5 sm:p-6">
        {/* Screen-reader-only live announcement — fires once, on render, when this card appears in the results. */}
        <p role="status" aria-live="polite" className="sr-only">
          A trusted external search result is available from {result.providerDisplayName}. It opens an official external website in a new tab.
        </p>

        <h3 id={`${announcementId}-heading`} className="text-lg font-semibold text-primary">
          {result.providerDisplayName}
        </h3>
        <p className="mt-1 text-sm text-muted">{[result.region, result.countryCode].filter(Boolean).join(" · ") || "International"}</p>

        {primarySource ? (
          <>
            <Badge tone="accent" className="mt-2 text-[11px]">
              {TRUSTED_NATIONAL_SOURCE_LABEL}
            </Badge>
            <p className="mt-2 text-sm text-text-soft">{primarySource.purpose}</p>
          </>
        ) : null}

        {result.appliedFilters.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Filters applied to this search">
            {result.appliedFilters.map((f) => (
              <Badge key={f.label} tone="info" className="text-[11px]">
                {f.label}: {f.value}
              </Badge>
            ))}
          </div>
        ) : null}

        {result.isFiltered ? (
          <p className="mt-3 text-sm text-text-soft">
            This link is pre-filtered to your search — {result.appliedFilters.map((f) => f.value).join(" + ") || "your criteria"}.
          </p>
        ) : (
          <div className="mt-3 rounded-[var(--radius-control)] border border-border-strong bg-surface-alt p-3 text-sm text-text-soft">
            <p className="font-medium text-text">This is the provider&apos;s official search page — not a pre-filtered result.</p>
            <p className="mt-1">{result.instructions}</p>
          </div>
        )}

        {result.warningText ? (
          <div
            className="mt-3 flex items-start gap-2 rounded-[var(--radius-control)] border px-3.5 py-3 text-sm"
            style={{ borderColor: "var(--brand-coral)", backgroundColor: "var(--brand-coral-pale)", color: "var(--brand-coral)" }}
            role="note"
          >
            <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{result.warningText}</p>
          </div>
        ) : null}

        <p className="mt-3 text-xs text-muted">
          {result.linkVerificationDate ? <>Last verified {result.linkVerificationDate}. </> : <>Verification date not yet recorded. </>}
          Programme availability, fees, and admission requirements must be confirmed with the institution.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <LinkButton
            href={goHref}
            target="_blank"
            rel="noopener noreferrer"
            trailingIcon={<ExternalLink aria-hidden="true" className="h-4 w-4" />}
          >
            {CONTINUE_ON_OFFICIAL_SOURCE_LABEL}
          </LinkButton>
          <p id={`${announcementId}-newtab`} className="text-xs text-muted">
            Opens an official external website in a new browser tab. {result.providerDisplayName} is not part of NextWise —
            availability and content on that site are managed entirely by {result.providerDisplayName}.
          </p>
        </div>
      </div>
    </article>
  );
}
