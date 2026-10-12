import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { COUNTRY_FLAGS } from "@/components/graphics/CountryFlags";
import { LAUNCH_COUNTRY_PRIMARY_SOURCES, type LaunchCountryPrimarySource } from "@/lib/education/external-search/launch-country-sources";
import { TRUSTED_NATIONAL_SOURCE_LABEL } from "@/lib/education/external-search/attribution";
import { getLaunchCountryPrimaryProviders } from "@/lib/supabase/education/external-search";
import { HOMEPAGE_WIDE_CONTAINER_CLASSNAME } from "./homepage-layout";
import { cn } from "@/lib/utils";

/**
 * UX10A — Homepage Section 3, "Trusted Study Explorer".
 *
 * [... history preserved from UX10A through UX10-H05B: see git history /
 * prior package docs for the full UX10A -> H02 -> H03 -> H05B narrative.
 * Summary of what's carried forward unchanged: every tile renders from
 * LAUNCH_COUNTRY_PRIMARY_SOURCES (src/lib/education/external-search/
 * launch-country-sources.ts) — the real six-country M20 registry — and
 * nothing else; the reference image's own Finland/Netherlands/Sweden
 * providers are intentionally NOT reproduced, per the standing "use the
 * M20 registry as source of truth" rule; each tile's real database row is
 * fetched server-side via getLaunchCountryPrimaryProviders for its safe
 * `/go/course-search/provider/[id]` redirect id, and a country whose row
 * is missing/inactive renders an honest "Currently unavailable" state. ]
 *
 * UX10-H06 "FINAL TOP-HOMEPAGE VISUAL CORRECTION PASS" — sections 9-12.
 * The new authoritative reference (IMAGE #2) shows a visibly different,
 * cleaner strip than H05B's own per-tile-tinted version: one uniform pale
 * panel background (not six separately-tinted segments), a simplified
 * intro block (eyebrow + heading + one short paragraph, no "Explore all
 * countries" link), a real circular flag badge per tile (see
 * CountryFlags.tsx), a bold blue source-name treatment, and a circular
 * arrow control at the BOTTOM of each tile (not top-right, as H05B had
 * it). Four scoped changes, same data/trust-model rules as every prior
 * pass:
 *
 * 1. INTRO BLOCK — the "Explore all countries" link is removed (not shown
 *    in the reference; `/courses` itself is still reachable from the
 *    header search icon and the Course Explorer card, so no navigation
 *    path is lost). A small, very low-opacity decorative globe + dashed
 *    flight-path + paper-airplane flourish (original inline SVG, same
 *    "no external image" convention as every other graphics/ file) sits
 *    bottom-left of the intro text, echoing the reference without
 *    pretending to be a functional element.
 *
 * 2. FLAGS — `countryCodeToFlagEmoji()` (a Unicode regional-indicator
 *    emoji) is replaced by CountryFlags.tsx's six original, locally-
 *    authored inline-SVG flags, rendered as circular badges. Emoji flags
 *    render inconsistently (or fall back to raw two-letter codes) across
 *    operating systems/browsers — exactly the "broken emoji rendering"
 *    this milestone's brief calls out. The underlying data read is
 *    unchanged (still `source.countryCode`, the same real ISO code every
 *    prior milestone used); only the rendering changed.
 *
 * 3. TILE COPY — each tile's displayed authority name and one-line
 *    "purpose" sentence are tightened to the brief's own exact shorter
 *    copy (section 11), via the two local DISPLAY_* maps below, for the
 *    compact tile design the reference calls for. This does NOT touch
 *    LAUNCH_COUNTRY_PRIMARY_SOURCES itself (the registry's own `purpose`
 *    field — a longer, fuller sentence — remains the real data source of
 *    truth; the maps below are presentation-only paraphrases of it, not a
 *    new or fabricated data source). ONE deliberate, documented exception:
 *    the reference's Canada tile is branded "EduCanada," but the real
 *    LAUNCH_COUNTRY_PRIMARY_SOURCES registry's actual Canada entry is
 *    `authority: "Government of Canada"` (the real seeded provider — see
 *    launch-country-sources.ts). There is no "EduCanada" provider row in
 *    this project's real data. Per this milestone's own section 11
 *    instruction — "KEEP existing real routes/source data; DO NOT invent
 *    partnerships" — the REAL authority name is kept for Canada rather
 *    than displaying an invented partner name the registry doesn't back.
 *    This is the one tile where the reference's cosmetic label and this
 *    project's real data diverge; documented here and in the H06 audit.
 *
 * 4. DENSITY / CONTROL POSITION — the outer panel moves from six
 *    individually-tinted segments to one uniform, pale, flat panel
 *    background (matching the reference), each tile's circular arrow
 *    control moves from top-right (next to the flag) to the bottom of the
 *    tile (below the purpose text, matching the reference), and the
 *    per-tile `ShieldCheck` / "Trusted national source" badge chip —
 *    visible in every prior milestone's own screenshot, but NOT shown
 *    anywhere in this milestone's authoritative reference — moves from a
 *    visible `Badge` pill to an `sr-only` (visually hidden, screen-reader
 *    only) element. The trust signal itself is NOT deleted: assistive-
 *    technology users still hear "Trusted national source" announced for
 *    every tile (via the sr-only span below, and it's additionally folded
 *    into each tile's own `aria-label`); sighted users get the reference's
 *    cleaner, chip-free tile design. This is a visual-only change — same
 *    real badge label text, same real trust claim, just no longer a
 *    rendered pixel, per this milestone's own "THE REFERENCE WINS" rule
 *    for visual composition. A faint per-country tone ring behind each
 *    flag badge (`color-mix` against each tile's existing
 *    `BADGE_TONE_CYCLE` color) keeps a subtle, barely-visible echo of the
 *    established per-country color system without reproducing H05B's
 *    more saturated full-tile tint, which the reference no longer shows.
 */
const BADGE_TONE_CYCLE = [
  { bg: "var(--surface-soft-blue)", fg: "var(--surface-soft-blue-strong)" },
  { bg: "var(--surface-soft-cyan)", fg: "var(--surface-soft-cyan-strong)" },
  { bg: "var(--surface-soft-mint)", fg: "var(--surface-soft-mint-strong)" },
  { bg: "var(--surface-soft-amber)", fg: "var(--surface-soft-amber-strong)" },
  { bg: "var(--surface-soft-lavender)", fg: "var(--surface-soft-lavender-strong)" },
  { bg: "var(--surface-soft-pink)", fg: "var(--surface-soft-pink-strong)" },
];

/**
 * Tightened display copy for the compact H06 tile design — see this
 * file's own docblock, item 3. Presentation-only; the registry's own
 * `purpose` field (a fuller sentence) remains the real data source of
 * truth and is still what a11y tooling / other call sites would read.
 */
const DISPLAY_AUTHORITY: Record<LaunchCountryPrimarySource["countryCode"], string> = {
  DE: "DAAD",
  GB: "Study UK",
  US: "EducationUSA",
  // Real registry authority is "Government of Canada" — kept as-is rather
  // than the reference's "EduCanada" (not a real provider in this
  // project's data). See this file's docblock, item 3.
  CA: "Government of Canada",
  AU: "Study Australia",
  IE: "Education in Ireland",
};

const DISPLAY_PURPOSE: Record<LaunchCountryPrimarySource["countryCode"], string> = {
  DE: "Official programmes and guidance",
  GB: "Official information for international students",
  US: "Explore study options and requirements",
  CA: "Find programmes and plan your study",
  AU: "Courses and visas for international students",
  IE: "Discover study opportunities",
};

export async function TrustedStudyExplorer() {
  const providers = await getLaunchCountryPrimaryProviders();
  const providerBySlug = new Map(providers.map((p) => [p.slug, p]));

  return (
    <Section tone="surface" containerClassName={HOMEPAGE_WIDE_CONTAINER_CLASSNAME} className="!py-8 sm:!py-10 lg:!py-12">
      {/* One connected, uniformly-tinted horizontal panel —
          [INTRO][DE][UK][US][CA][AU][IE] — matching the H06 reference's
          compact, flat-panel strip (not H05B's six separately-tinted
          segments). See this file's own docblock, item 4. */}
      <div
        className="overflow-hidden rounded-[1.25rem] border border-border/50 shadow-soft"
        style={{ backgroundColor: "color-mix(in srgb, var(--surface-soft-lavender) 22%, var(--color-surface))" }}
      >
        <div className="flex flex-col lg:flex-row lg:divide-x lg:divide-border/50">
          <div className="relative shrink-0 overflow-hidden border-b border-border/50 p-6 lg:w-[22%] lg:border-b-0 lg:p-7">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
              Explore programmes from official sources
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-primary sm:text-[1.7rem]">Trusted Study Explorer</h2>
            <p className="mt-2.5 text-sm leading-relaxed text-muted">
              Search programmes directly from official higher-education sources around the world.
            </p>

            {/* Small, low-opacity decorative flourish (globe + dashed
                flight path + paper airplane) — original inline SVG, purely
                decorative, matching the reference's bottom-left accent.
                See this file's own docblock, item 1. */}
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
            {LAUNCH_COUNTRY_PRIMARY_SOURCES.map((source, index) => {
              const provider = providerBySlug.get(source.providerSlug);
              const tone = BADGE_TONE_CYCLE[index % BADGE_TONE_CYCLE.length];
              const available = Boolean(provider);
              const Flag = COUNTRY_FLAGS[source.countryCode];

              const tileBody = (
                <>
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white"
                    style={{ boxShadow: `0 0 0 3px color-mix(in srgb, ${tone.bg} 55%, transparent)` }}
                  >
                    <Flag aria-hidden="true" className="h-10 w-10" />
                  </span>

                  <p className="mt-3 text-sm font-semibold text-text">{source.countryName}</p>
                  <p className="mt-0.5 text-sm font-semibold leading-snug text-primary">{DISPLAY_AUTHORITY[source.countryCode]}</p>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-text-soft">{DISPLAY_PURPOSE[source.countryCode]}</p>

                  {!available ? (
                    <p className="mt-1.5 text-[11px] font-medium text-muted">Currently unavailable — check back soon.</p>
                  ) : null}

                  {/* Trust signal kept for assistive technology, matching
                      the reference's chip-free visual design — see this
                      file's own docblock, item 4. */}
                  <span className="sr-only">
                    <ShieldCheck aria-hidden="true" className="inline h-3 w-3" />
                    {TRUSTED_NATIONAL_SOURCE_LABEL}
                  </span>

                  <span
                    aria-hidden="true"
                    className="mt-3 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-primary transition-all duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                  >
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                      <path d="M3 8h10M8.5 3.5 13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </>
              );

              const tileClassName = cn(
                "group flex h-full flex-col p-4 transition-colors duration-200",
                !available && "opacity-70"
              );

              return (
                <li key={source.countryCode}>
                  {available ? (
                    <Link
                      href={`/go/course-search/provider/${provider!.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={tileClassName}
                      aria-label={`${DISPLAY_AUTHORITY[source.countryCode]} — ${TRUSTED_NATIONAL_SOURCE_LABEL.toLowerCase()} for studying in ${source.countryName}. Opens in a new tab.`}
                    >
                      {tileBody}
                    </Link>
                  ) : (
                    <div className={tileClassName}>{tileBody}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Section>
  );
}
