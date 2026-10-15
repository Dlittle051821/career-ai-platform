import { ExternalLink, Globe2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { EUROPE_COUNTRIES } from "@/data/europe-explorer";
import { EUROPE_EXPLORER_FLAGS } from "@/components/graphics/EuropeExplorerFlags";
import {
  CONTINUE_ON_OFFICIAL_SOURCE_LABEL,
  EXTERNAL_LINK_BADGE_LABEL,
  TRUSTED_SOURCE_ATTRIBUTION_LABEL,
} from "@/lib/education/external-search/attribution";

/**
 * UX10-EU01 — the reference's "Go directly to official sources" section
 * (section 5), one of the most important sections on this page per the
 * brief. Reuses the EXISTING M20 attribution wording constants
 * (`TRUSTED_SOURCE_ATTRIBUTION_LABEL`/`EXTERNAL_LINK_BADGE_LABEL`/
 * `CONTINUE_ON_OFFICIAL_SOURCE_LABEL`, from `src/lib/education/
 * external-search/attribution.ts`) rather than inventing new copy, so
 * this page's trusted-source language matches `/courses`'/`/universities`'
 * exactly.
 *
 * Deliberately NOT routed through the M20 `/go/course-search/**`
 * redirect: that route resolves a real Supabase `external_search_
 * providers` row id, which only exists today for Germany and Ireland (the
 * two countries this page shares with the M20 registry) — Netherlands,
 * France, Sweden, and Denmark have no such row, and this milestone's own
 * rules forbid any database change (no migration, no seed) to add one.
 * Rather than give 2 of 6 countries a different, richer link mechanism
 * than the other 4, every country here uses the same plain, safe,
 * directly-verified external link — see UX10-EU01_REFERENCE_AUDIT.md
 * section 6 for the full reasoning, and `src/lib/education/external-
 * search/url-validation.ts`'s `validateExternalUrl`, reused by this
 * milestone's own test suite to assert every one of these 6 URLs is
 * HTTPS, credential-free, and genuinely hosted on its claimed domain.
 *
 * Every link opens in a new tab with `rel="noopener noreferrer"`, is
 * visually and textually marked as an external website, and the
 * section's own closing disclosure states plainly that Nextwise is not
 * affiliated with, sponsored by, or endorsed by any of these six official
 * portals — never implying partnership.
 */
export function EuropeOfficialSourcesSection() {
  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {EUROPE_COUNTRIES.map((country) => {
          const Flag = EUROPE_EXPLORER_FLAGS[country.code];
          const { officialSource } = country;
          return (
            <Card key={country.code} id={country.slug} className="scroll-mt-24 rounded-[20px] border border-border/80">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-alt">
                  <Flag aria-hidden="true" className="h-10 w-10" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                    {TRUSTED_SOURCE_ATTRIBUTION_LABEL}
                  </p>
                  <h3 className="text-base font-semibold text-text">{country.name}</h3>
                </div>
              </div>

              <p className="mt-3 text-sm font-semibold text-primary">{officialSource.authority}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-text-soft">{officialSource.purpose}</p>

              <LinkButton
                href={officialSource.url}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                size="md"
                className="mt-5 w-full justify-center"
                trailingIcon={<ExternalLink aria-hidden="true" className="h-4 w-4" />}
                aria-label={`${CONTINUE_ON_OFFICIAL_SOURCE_LABEL} for ${country.name} — ${officialSource.authority}. Opens in a new tab.`}
              >
                {CONTINUE_ON_OFFICIAL_SOURCE_LABEL}
              </LinkButton>
              <p className="mt-2 text-xs text-muted">
                {EXTERNAL_LINK_BADGE_LABEL} · {officialSource.primaryDomain}
              </p>
            </Card>
          );
        })}
      </div>

      <p className="mt-6 flex items-start gap-2 rounded-2xl border border-border/80 bg-surface-alt px-4 py-3.5 text-sm text-text-soft">
        <Globe2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
        Nextwise is not affiliated with, sponsored by, or endorsed by any of these official portals. Each site is
        managed entirely by its own organisation — availability, content, and requirements are theirs, not ours.
      </p>
    </div>
  );
}
