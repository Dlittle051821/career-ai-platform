import { ExternalLink, ShieldAlert, Globe2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
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

  return (
    <article
      className="overflow-hidden rounded-[var(--radius-card)] border-2 border-[var(--brand-ink)] bg-surface"
      aria-labelledby={`${announcementId}-heading`}
    >
      <div className="flex items-center justify-between gap-3 px-5 py-3 text-white" style={{ backgroundColor: "var(--brand-ink)" }}>
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          <Globe2 aria-hidden="true" className="h-4 w-4" />
          Official external portal
        </span>
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium">{result.officialDomain}</span>
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
            Open official course search
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
