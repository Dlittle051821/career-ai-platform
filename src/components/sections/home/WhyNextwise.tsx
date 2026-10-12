import { CheckCircle2, Globe2, ShieldCheck, UserCheck } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { NetworkGraphic } from "@/components/graphics/NetworkGraphic";
import { BRAND_NAME } from "@/config/site";
import { LAUNCH_COUNTRY_PRIMARY_SOURCES } from "@/lib/education/external-search/launch-country-sources";
import { getGraphicAriaProps } from "@/lib/graphics/accessible-graphic";
import { HOMEPAGE_CONTAINER_CLASSNAME } from "./homepage-layout";

/**
 * UX10A — Homepage Section 5, "Why Nextwise".
 *
 * The approved reference image's right-hand panel is a named-student
 * testimonial ("Riya Sharma... Nextwise Student") plus a "500K+ Students
 * guided" stat chip. No genuine testimonial exists anywhere in this
 * codebase (confirmed: no "testimonial" reference in src/) and no
 * verified student-count metric exists either — inventing either would be
 * exactly what the task's own "Content Integrity" section forbids ("DO
 * NOT COPY FROM THE MOCKUP: fake testimonial names... unsupported... DO
 * NOT use '500K+ students guided' unless supported by real company
 * data"). The right panel is replaced with the task brief's own suggested
 * factual trust card, word for word, instead of a fabricated quote.
 *
 * The left panel's checklist is the reference image's own original
 * checklist copy (not the right panel's replacement list) — these are
 * qualitative, non-numeric statements about how the product already
 * works, not invented statistics.
 *
 * UX10-H02 "HOMEPAGE PREMIUM VISUAL REFINEMENT" — reused the already-
 * approved, purely abstract NetworkGraphic component as a large, very-
 * low-opacity decorative watermark behind the trust list, filling what
 * was previously empty card space.
 *
 * UX10-H03 "EXACT HOMEPAGE REFERENCE MATCH" — the reference shows this
 * section as THREE columns: a left checklist (kept), a center "proof"
 * panel with a photo + quoted testimonial, and a right column of three
 * bold stat tiles ("500K+ Students guided" / "4.8/5 Student satisfaction"
 * / "50+ Countries & destinations"). None of that center/right content is
 * real or verifiable in this codebase — no testimonial data exists
 * anywhere in this project (confirmed: no "testimonial" reference in
 * src/), and no verified student-count/rating/country-count metric
 * exists either beyond the one number this repo's own data actually
 * proves: LAUNCH_COUNTRY_PRIMARY_SOURCES has exactly six entries, the
 * real launch-country registry M20 built and TrustedStudyExplorer.tsx
 * already renders from. The brief's own "Content Integrity"-style
 * instruction for this exact situation is explicit: "DO NOT use fake
 * numbers... do not invent testimonials... if testimonial data is not
 * real, use a non-testimonial supporting visual / trust panel while
 * keeping the overall reference composition" — so this still builds the
 * reference's three-column FOOTPRINT, but with honest content in the
 * center/right slots: the center panel keeps H02's own NetworkGraphic
 * trust card (moved into the center column, not fabricated), and the
 * right column becomes three short stat-tiles in the same bold-number/
 * small-caption visual format the reference uses, except the one
 * genuinely numeric tile uses the real, live count of launch countries
 * (`LAUNCH_COUNTRY_PRIMARY_SOURCES.length`, currently 6 — the same
 * number TrustedStudyExplorer.tsx itself proves on this very page) and
 * the other two are qualitative, non-numeric trust statements rather
 * than invented ratings. Both checklists' copy is completely unchanged.
 *
 * UX10-H07 "LOWER HOMEPAGE REFERENCE MATCH" — the center column was the
 * biggest gap against this milestone's own reference: the reference shows
 * a warm, photographic, student-focused visual with a trust card FLOATING
 * over it, where this component's own H03 version put two separate,
 * side-by-side boxes (an abstract gradient card with a small
 * NetworkGraphic watermark). No new photograph was supplied with this
 * milestone's brief, and no real testimonial/quote content exists
 * anywhere in this codebase (still confirmed: no "testimonial" reference
 * in src/) — so, per this milestone's own explicit "if exact content
 * isn't verified, match the VISUAL STRUCTURE, keep content honest, do not
 * fabricate a testimonial" instruction, the center column is rebuilt
 * using this project's own EXISTING APPROVED real assets rather than a
 * new stock photo: the hero's real `campus-sky-backdrop.png` (an
 * atmosphere behind the frame) and real `nextwise-student-cutout.png`
 * (the subject), composed inside one rounded, shadowed photo card — the
 * same two real, already-licensed-for-this-site assets the hero itself
 * uses, reused here for visual/brand consistency rather than a third
 * photograph. `NetworkGraphic` (required to stay present — see this
 * file's own test coverage) now sits as a faint texture directly behind
 * the floating trust card instead of behind the old abstract box, same
 * `accessibility={{ kind: "decorative" }}` / `animate={false}` props,
 * same decorative-only, no-real-data-claimed treatment. The trust card
 * itself keeps its exact original checklist copy, now presented as a
 * compact white card floating over the bottom of the photo (matching the
 * reference's own "floating badge" composition) rather than a full-height
 * box beside it. The right-hand column's three honest stat tiles are
 * unchanged in content (still the real `LAUNCH_COUNTRY_PRIMARY_SOURCES`
 * count plus two qualitative, non-numeric trust statements — no
 * testimonial, no invented rating, no fabricated student count), just
 * restyled slightly for a more premium, consistent card treatment
 * matching the reference's own cleaner stat tiles. The left column's
 * heading/copy/checklist are untouched.
 */
const LEFT_CHECKLIST = [
  "Independent and student-first",
  "Global destinations and trusted sources",
  "Personalised guidance from experienced counsellors",
  "All in one place",
];

const TRUST_CARD_ITEMS = [
  "Independent and student-first",
  "Trusted official sources",
  "Structured career-to-course discovery",
  "Personalised counsellor guidance",
  "One connected decision journey",
];

const LAUNCH_COUNTRY_COUNT = LAUNCH_COUNTRY_PRIMARY_SOURCES.length;

const PROOF_TILES = [
  { icon: Globe2, value: String(LAUNCH_COUNTRY_COUNT), label: "Launch countries, official sources" },
  { icon: ShieldCheck, value: "Independent", label: "No commission bias, ever" },
  { icon: UserCheck, value: "Personalised", label: "Real counsellor guidance" },
];

export function WhyNextwise() {
  const decorative = getGraphicAriaProps({ kind: "decorative" });

  return (
    <Section tone="default" containerClassName={HOMEPAGE_CONTAINER_CLASSNAME} className="!py-10 sm:!py-12 lg:!py-16">
      <div className="grid gap-8 lg:grid-cols-[0.95fr_0.9fr_0.6fr] lg:items-stretch lg:gap-7">
        <div className="lg:self-center">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-secondary">
            <span aria-hidden="true" className="h-px w-6 bg-secondary" />
            Why Nextwise
          </p>
          <h2 className="text-2xl font-semibold text-primary sm:text-3xl">
            More than a search engine.
            <br />A partner in your journey.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted sm:text-base">
            We combine trusted information, technology, and human guidance to help you make the right decisions —
            for your education, career, and life beyond.
          </p>

          <ul className="mt-6 space-y-3">
            {LEFT_CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm font-medium text-text-soft">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* UX10-H07 — a warm, photographic center column (reusing the
            hero's own real, already-approved assets — see this file's own
            docblock) with the trust card now floating over its lower
            portion, matching the reference's composition. */}
        <div className="relative isolate overflow-hidden rounded-[1.5rem] shadow-lifted">
          <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[10/11]">
            <img
              {...decorative}
              src="/hero/campus-sky-backdrop.png"
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: "60% 20%" }}
            />
            {/* Warm color-grade wash — the real backdrop photo is a cool
                midday sky; this shifts its apparent temperature toward
                the reference's own warm, golden-hour mood without
                altering or replacing the asset itself. A plain
                normal-blend tint (not mix-blend-mode) so it renders
                consistently across browsers/screenshot tooling rather
                than depending on compositing support. Layered under the
                readability fade below. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background: "linear-gradient(195deg, #e8935a 0%, #f0ab6e 28%, transparent 62%)",
                opacity: 0.4,
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(185deg, color-mix(in srgb, var(--color-primary) 8%, transparent) 0%, transparent 35%, color-mix(in srgb, white 55%, transparent) 100%)",
              }}
            />
            <img
              {...decorative}
              src="/hero/nextwise-student-cutout.png"
              alt=""
              loading="lazy"
              className="absolute bottom-0 left-1/2 w-[78%] max-w-[260px] -translate-x-1/2 object-contain object-bottom drop-shadow-md sm:w-[72%]"
            />
          </div>

          {/* Floating trust card — original checklist copy unchanged, now
              a compact card over the photo's lower edge rather than a
              separate full-height box beside it. */}
          <div className="absolute inset-x-4 bottom-4 overflow-hidden rounded-[1.25rem] bg-white/95 p-4 shadow-lifted backdrop-blur-sm sm:inset-x-5 sm:bottom-5 sm:p-5">
            <NetworkGraphic
              accessibility={{ kind: "decorative" }}
              animate={false}
              className="pointer-events-none absolute -right-6 -bottom-6 h-28 w-28 opacity-[0.07] text-primary"
            />
            <div className="relative flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: "var(--surface-soft-blue)", color: "var(--surface-soft-blue-strong)" }}
              >
                <ShieldCheck aria-hidden="true" className="h-4.5 w-4.5" />
              </span>
              <p className="font-serif text-base font-semibold text-primary sm:text-lg">Why students use {BRAND_NAME}</p>
            </div>

            <ul className="relative mt-3 space-y-2">
              {TRUST_CARD_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs font-medium leading-snug text-text-soft sm:text-[13px]">
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* UX10-H03 — the reference's right-hand stat column, rebuilt with
            honest content (see this file's own docblock for why no fake
            "500K+ / 4.8/5 / 50+" numbers appear here). Same bold-value/
            small-caption visual format as the reference's tiles; only the
            first tile is a genuine number, and it's the one this repo can
            actually prove (LAUNCH_COUNTRY_PRIMARY_SOURCES.length). */}
        <ul className="flex min-w-0 flex-row gap-3 lg:flex-col lg:justify-center lg:gap-3.5">
          {PROOF_TILES.map(({ icon: Icon, value, label }) => (
            <li
              key={label}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-[1.25rem] border border-border/50 bg-surface p-4 shadow-soft transition-shadow duration-200 hover:shadow-lifted lg:flex-none"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--surface-soft-cyan)", color: "var(--surface-soft-cyan-strong)" }}
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-bold leading-tight text-primary">{value}</p>
                <p className="text-[11px] leading-snug text-muted">{label}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
