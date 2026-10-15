import { ExternalLink } from "lucide-react";
import { EUROPE_COUNTRIES } from "@/data/europe-explorer";
import { EUROPE_EXPLORER_FLAGS } from "@/components/graphics/EuropeExplorerFlags";
import { HOMEPAGE_WIDE_CONTAINER_CLASSNAME } from "./homepage-layout";
import { Section } from "@/components/layout/Section";
import {
  EXTERNAL_LINK_BADGE_LABEL,
  TRUSTED_NATIONAL_SOURCE_LABEL,
} from "@/lib/education/external-search/attribution";

/**
 * UX10A — Homepage Section 3, "Trusted Study Explorer".
 *
 * [... history preserved from UX10A through UX10-H06: see git history /
 * prior package docs for the full UX10A -> H02 -> H03 -> H05B -> H06
 * narrative. Summary of what was true through UX10-H06: every tile
 * rendered from LAUNCH_COUNTRY_PRIMARY_SOURCES, the real M20 six-country
 * GLOBAL registry (DE/GB/US/CA/AU/IE), each routed through the safe
 * `/go/course-search/provider/[id]` DB-backed redirect. That architecture
 * is superseded below by UX10-EU02 — see that entry for why. ]
 *
 * UX10-EU02 "HOMEPAGE EUROPE ALIGNMENT" — Nextwise's public launch
 * positioning moves from a global six-country set (including the UK, USA,
 * Canada, Australia — none of which are approved Europe launch countries)
 * to India + Europe, with exactly six approved European launch countries:
 * Germany, Ireland, Netherlands, France, Sweden, Denmark. This section is
 * repointed accordingly, and this milestone's brief explicitly asks for it
 * under a new heading, "Trusted Official Sources" — the same conceptual
 * section the brief's own reference separately calls "Popular Study
 * Destinations" plus "Trusted Partners & Sources" combined. This codebase's
 * homepage architecture already merged those two concepts into ONE compact
 * section back in UX10A/H06 (each tile already carries a flag, country
 * name, AND an official-source name/purpose together) — per this
 * milestone's own "do not recreate the homepage from scratch" / "preserve
 * current approved composition" rules, that one-section architecture is
 * kept rather than split into two new sections; see
 * UX10-EU02_REFERENCE_AUDIT.md for the full reasoning.
 *
 * DATA SOURCE CHANGE: this component now imports `EUROPE_COUNTRIES` from
 * `src/data/europe-explorer.ts` (built for UX10-EU01's `/study-europe`
 * page) instead of the M20 `LAUNCH_COUNTRY_PRIMARY_SOURCES` registry —
 * reusing that canonical EU01 data rather than defining a second,
 * duplicate Europe country list, per this milestone's own "reuse EU01
 * data where sensible... avoid duplicate truth sources" instruction. The
 * M20 registry itself is completely untouched and still powers
 * `/courses`, `/universities`, and `/go/course-search/**` exactly as
 * before — nothing there was modified, migrated, or deleted.
 *
 * ARCHITECTURE CHANGE: every link here is now a plain, directly-verified
 * external link (`target="_blank" rel="noopener noreferrer"`, HTTPS-only,
 * domain-checked — the same `officialSource.url` EU01's own
 * `EuropeOfficialSourcesSection.tsx` uses), not the M20 DB-backed
 * `/go/course-search/provider/[id]` redirect. That redirect resolves a
 * real Supabase `external_search_providers` row id, which exists today for
 * only two of these six countries (Germany, Ireland) — this milestone
 * forbids any migration/seed to add the other four, and giving two
 * countries a different, richer link mechanism than the other four would
 * be inconsistent for no real benefit. This also means this component no
 * longer needs to be an async server component querying Supabase at all —
 * it is now a plain, synchronous, DB-free component, which incidentally
 * also means the old "Currently unavailable — check back soon" fallback
 * state (needed only because a provider row could be missing/inactive) no
 * longer applies: every one of these six countries always has a real,
 * directly-verified URL, so every tile is always "available." See
 * `src/data/europe-explorer.ts`'s own docblock for the full source-
 * verification record for all six countries.
 *
 * GERMANY "RECOMMENDED FIRST": matching EU01's own country-card treatment,
 * Germany's tile gets a small visible badge plus a slightly stronger ring
 * around its flag — positioned as the best starting point for most
 * students, not a guarantee of the best outcome for everyone.
 *
 * NO-AFFILIATION DISCLOSURE: a compact, visible disclosure line below the
 * tile row states plainly that Nextwise is not affiliated with or
 * endorsed by these official portals — reusing the same wording
 * discipline as EU01's own official-sources section rather than inventing
 * new copy.
 *
 * Everything else about this section's established visual language is
 * preserved: the single uniform pale panel, the intro block's decorative
 * globe/flight-path flourish, the circular flag badges, the bold blue
 * source-name treatment, and the bottom-of-tile circular arrow control.
 */
const BADGE_TONE_CYCLE = [
  { bg: "var(--surface-soft-blue)", fg: "var(--surface-soft-blue-strong)" },
  { bg: "var(--surface-soft-cyan)", fg: "var(--surface-soft-cyan-strong)" },
  { bg: "var(--surface-soft-mint)", fg: "var(--surface-soft-mint-strong)" },
  { bg: "var(--surface-soft-amber)", fg: "var(--surface-soft-amber-strong)" },
  { bg: "var(--surface-soft-lavender)", fg: "var(--surface-soft-lavender-strong)" },
  { bg: "var(--surface-soft-pink)", fg: "var(--surface-soft-pink-strong)" },
];

export function TrustedStudyExplorer() {
  return (
    <Section tone="surface" containerClassName={HOMEPAGE_WIDE_CONTAINER_CLASSNAME} className="!py-8 sm:!py-10 lg:!py-12">
      {/* One connected, uniformly-tinted horizontal panel —
          [INTRO][DE][IE][NL][FR][SE][DK] — same compact, flat-panel strip
          convention as UX10-H06, now showing the six Europe launch
          countries instead of the six global M20 countries. */}
      <div
        className="overflow-hidden rounded-[1.25rem] border border-border/50 shadow-soft"
        style={{ backgroundColor: "color-mix(in srgb, var(--surface-soft-lavender) 22%, var(--color-surface))" }}
      >
        <div className="flex flex-col lg:flex-row lg:divide-x lg:divide-border/50">
          <div className="relative shrink-0 overflow-hidden border-b border-border/50 p-6 lg:w-[22%] lg:border-b-0 lg:p-7">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Explore European sources</p>
            <h2 className="mt-2 text-2xl font-semibold text-primary sm:text-[1.7rem]">Trusted Official Sources</h2>
            <p className="mt-2.5 text-sm leading-relaxed text-muted">
              Go directly to official government and education sources for our six European launch countries.
            </p>

            {/* Small, low-opacity decorative flourish (globe + dashed
                flight path + paper airplane) — original inline SVG, purely
                decorative, unchanged from UX10-H06. */}
            <svg
              aria-hidden="true"
              viewBox="0 0 160 90"
              className="pointer-events-none absolute -bottom-4 -left-6 h-20 w-36 opacity-[0.14] sm:h-24 sm:w-40"
            >
              <circle cx="30" cy="70" r="26" fill="none" stroke="var(--color-primary)" strokeWidth="2" />
              <path d="M8 70 H52 M30 48 V92 M14 56 Q30 70 46 56 M14 84 Q30 70 46 84" stroke="var(--color-primary)" strokeWidth="1.2" fill="none" />
              <path d="M38 52 Q85 20 140 18" stroke="var(--color-primary)" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
              <path d="M140 18 L128 13 L132 23 Z" fill="var(--color-primary)" />
            </svg>
          </div>

          <ul className="grid flex-1 divide-y divide-border/50 sm:grid-cols-3 sm:divide-x sm:divide-y-0 xl:grid-cols-6">
            {EUROPE_COUNTRIES.map((country, index) => {
              const tone = BADGE_TONE_CYCLE[index % BADGE_TONE_CYCLE.length];
              const Flag = EUROPE_EXPLORER_FLAGS[country.code];
              const { officialSource } = country;

              return (
                <li key={country.code}>
                  <a
                    href={officialSource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex h-full flex-col p-4 transition-colors duration-200"
                    aria-label={`${officialSource.authority} — ${TRUSTED_NATIONAL_SOURCE_LABEL.toLowerCase()} for studying in ${country.name}${country.recommended ? ", recommended first" : ""}. Opens in a new tab.`}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white"
                      style={{
                        boxShadow: country.recommended
                          ? "0 0 0 3px var(--color-primary)"
                          : `0 0 0 3px color-mix(in srgb, ${tone.bg} 55%, transparent)`,
                      }}
                    >
                      <Flag aria-hidden="true" className="h-10 w-10" />
                    </span>

                    <p className="mt-3 text-sm font-semibold text-text">{country.name}</p>
                    {country.recommended ? (
                      <span className="mt-1 inline-flex w-fit items-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-on-primary">
                        Recommended First
                      </span>
                    ) : null}
                    <p className="mt-1.5 text-sm font-semibold leading-snug text-primary">{officialSource.authority}</p>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-text-soft">{officialSource.purpose}</p>

                    <span className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-muted">
                      <ExternalLink aria-hidden="true" className="h-3 w-3" />
                      {EXTERNAL_LINK_BADGE_LABEL} · {officialSource.primaryDomain}
                    </span>

                    {/* Trust signal kept for assistive technology, matching
                        the H06 reference's chip-free visual design. */}
                    <span className="sr-only">{TRUSTED_NATIONAL_SOURCE_LABEL}</span>

                    <span
                      aria-hidden="true"
                      className="mt-3 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-primary transition-all duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                    >
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                        <path d="M3 8h10M8.5 3.5 13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* No-affiliation disclosure — same wording discipline as EU01's own
          official-sources section, reused rather than re-invented. */}
      <p className="mt-4 text-xs leading-relaxed text-muted">
        Nextwise is not affiliated with or endorsed by these official portals.
      </p>
    </Section>
  );
}
