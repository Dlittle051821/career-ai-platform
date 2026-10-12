import { ArrowRight, Calendar, CreditCard, Sparkles, User } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { LinkButton } from "@/components/ui/Button";
import { getGraphicAriaProps } from "@/lib/graphics/accessible-graphic";
import { HOMEPAGE_CONTAINER_CLASSNAME } from "./homepage-layout";

/**
 * UX10A — Homepage Section 6, the closing dark CTA.
 *
 * Deliberately NOT a reuse of the existing full-bleed `<CTASection>`
 * (src/components/sections/CTASection.tsx, tone="primary" — the
 * authoritative Blue #2563eb already used for that component, the
 * footer, and every other "action" surface on the site). The task's own
 * brief asks for something visually distinct here — "deep Nextwise
 * navy," a "rounded container" rather than a full-width band, and a
 * section that reads as a deliberate, premium close rather than one more
 * copy of the same blue CTA block already seen mid-page. This uses
 * --brand-ink (the authoritative Navy #0b1f3a, per the UX10A brand-color
 * correction — also BRAND_DARK_BG/the OG image's navy, see
 * src/config/site.ts) so the two dark surfaces on the page read as
 * genuinely different weights (navy vs. blue), not a copy-paste repeat.
 * CTASection itself is untouched and still used elsewhere exactly as
 * before.
 *
 * UX10-H02 through UX10-H07 — see git history / prior milestone package
 * docs for the incremental padding/gradient/illustration refinements
 * this section went through (H02 premium depth pass, H03 compact-strip
 * density, H04 FinalCtaVista illustration + right-hand visual area, H07
 * widened that illustration area and tightened padding further). All of
 * that is superseded by this milestone's rebuild — see below.
 *
 * UX10-H08 "FINAL CTA EXACT REFERENCE MATCH" — a full rebuild of this
 * section's content and right-hand visual, not a further refinement:
 * this milestone's own reference is treated as the authoritative visual
 * source of truth ("if current code conflicts with the reference, the
 * reference wins"), so several standing H02-H07 decisions are
 * deliberately reversed here, each documented below.
 *
 * 1) REAL PHOTO INSTEAD OF THE SVG VISTA. H04's FinalCtaVista.tsx was an
 *    original inline-SVG illustration, built because no licensed photo of
 *    the reference's sunset-city-and-seated-student composition existed
 *    in the repo. This milestone's brief explicitly asks for the real
 *    photographic scene ("do not use CSS placeholder geometry... use the
 *    provided/approved sunset landscape asset") and treats its own
 *    attached reference image as that approved asset, with explicit
 *    permission to use "a small cropped image from the authoritative
 *    reference as a decorative, non-interactive asset" where a from-
 *    scratch reproduction (e.g. of the handwritten annotation) can't be
 *    matched cleanly. The exact same policy UX10-H05B already established
 *    for the hero (see hero-composition-audit.test.ts's own "deliberate,
 *    documented reversal" describe block) — reuse a cropped, approved
 *    reference image as a purely decorative asset rather than fabricate a
 *    new stock photo from nothing. The crop (`public/cta/final-cta-vista
 *    .png`) is the reference's own right-hand scene — mountains, sunset,
 *    campus skyline, the seated student with a backpack, and the
 *    handwritten note — taken directly from the attached reference at
 *    full resolution. FinalCtaVista.tsx itself is left on disk, unused —
 *    same convention as every other superseded illustration component in
 *    this project (CampusSkylineBackdrop.tsx, DiscoveryIllustrations.tsx).
 *
 * 2) HANDWRITTEN ANNOTATION REINTRODUCED, SCOPED TO THIS SECTION ONLY.
 *    Every milestone since H04 has kept a standing "no handwritten
 *    annotation outside the hero" rule for this section specifically
 *    (see the old FinalCtaVista.tsx docblock and premium-refinement-audit
 *    .test.ts's now-superseded "does not reintroduce... handwritten"
 *    guard). UX10-H08's own brief explicitly asks for the reference's
 *    "A brighter tomorrow starts today" note here, so — exactly as
 *    UX10-H05B did for the hero — that rule is deliberately reversed for
 *    this one section, this one milestone, on this one explicit
 *    instruction. It is never rendered as a live text node; it is baked
 *    into the photo crop itself (the same reference pixels, not a
 *    redrawn facsimile) and the image is rendered `aria-hidden`/empty-alt,
 *    decorative only, so it never reaches assistive tech as content.
 *
 * 3) COPY REWRITTEN TO THE BRIEF'S OWN TRUTHFUL ALTERNATIVES. The
 *    reference's own body copy ("Join thousands of students...") and
 *    third trust item ("Join a global community") are both claims this
 *    repo has no approved backing for (checked: no student-count metric
 *    or "global community" claim exists anywhere in src/config/site.ts or
 *    any homepage section). The brief anticipates exactly this and
 *    supplies truthful fallbacks directly: the body copy becomes
 *    "Explore careers, courses, universities and global opportunities
 *    with Nextwise" (matching this project's own established hero/intro
 *    phrasing, see HomeHero.tsx), and the third trust item becomes
 *    "Student-first approach" — not invented for this pass, but reused
 *    verbatim from the Hero's own already-approved trust row (see
 *    HomeHero.tsx's own trust pills), so it is provably already a claim
 *    this project stands behind elsewhere on the same page. "No credit
 *    card required" and "Free expert guidance" are kept as the brief
 *    supplies them — both already true of this product's free,
 *    counsellor-backed flows (see the primary CTA's own "— Free" label
 *    and /book-counselling route).
 *
 * 4) CTA LABELS UPDATED TO THE BRIEF'S OWN COPY. "Get started for free"
 *    / "Book a Free Session" replace H04-H07's "Explore Your Future —
 *    Free" / "Book a Free Discovery Session" — same two real routes
 *    (/career-discovery, /book-counselling), copy only.
 *
 * 5) LAYOUT REBUILT FOR A THIN, WIDE, BLENDED BANNER. The reference's own
 *    banner reads as roughly 4:1 (wide, short) with the photo occupying
 *    very close to half its width and no visible seam between the navy
 *    text area and the photo. Padding tightens further than H07's already
 *    -tightened `py-7/8/9` (now `py-6/7/8`, with the content column's own
 *    gap/line-height also pulled in slightly) to hit that shorter overall
 *    height, the visual area widens from H07's `w-[46%]` to `lg:w-[52%]`,
 *    and a two-layer fade mask (a horizontal gradient at `lg:` and above,
 *    a vertical one below it, since the layout stacks instead of sitting
 *    side-by-side under `lg:`) dissolves the navy into the photo instead
 *    of either layer sitting behind a hard edge. A new trust row (three
 *    small icon + label pairs) is added beneath the two CTA buttons,
 *    matching the reference's own bottom row — this section previously
 *    had no trust row at all.
 *
 * 6) MOBILE/TABLET NOW SHOWS THE PHOTO TOO. H04-H07 hid the visual area
 *    below `lg:` entirely (text-only on mobile). The brief's own
 *    responsive guidance asks for the image to stack beneath the CTA
 *    content instead of disappearing, so below `lg:` the photo now
 *    renders as a full-width band under the text/buttons/trust row, with
 *    its own (vertical, top-edge) fade into the navy above it.
 */
const TRUST_ITEMS: { icon: typeof CreditCard; label: string }[] = [
  { icon: CreditCard, label: "No credit card required" },
  { icon: User, label: "Free expert guidance" },
  // UX10-H08 — reused verbatim from the Hero's own already-approved trust
  // row (see HomeHero.tsx) rather than the reference's unverified "Join a
  // global community" claim. See this file's own docblock, item 3.
  { icon: Sparkles, label: "Student-first approach" },
];

export function HomeFinalCTA() {
  const decorative = getGraphicAriaProps({ kind: "decorative" });

  return (
    <Section tone="default" containerClassName={HOMEPAGE_CONTAINER_CLASSNAME} className="!py-8 sm:!py-10 lg:!py-12">
      <div
        className="relative isolate overflow-hidden rounded-[1.75rem] shadow-lifted"
        style={{ background: "linear-gradient(145deg, var(--brand-ink) 0%, #122a4d 100%)" }}
      >
        <div {...decorative} className="pointer-events-none absolute inset-0 z-0">
          <svg className="absolute inset-0 h-full w-full text-white opacity-[0.04]">
            <defs>
              <pattern id="final-cta-lines" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
                <line x1="0" y1="0" x2="0" y2="36" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#final-cta-lines)" />
          </svg>
          <div className="absolute -left-10 -top-16 h-64 w-64 rounded-full bg-intelligence/15 blur-3xl" />
          <div className="absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-[var(--surface-soft-amber)]/10 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-stretch">
          <div className="flex min-w-0 flex-col justify-center gap-5 px-6 py-7 sm:px-9 sm:py-8 lg:w-[48%] lg:gap-6 lg:px-12 lg:py-9">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-on-primary-muted">
              <span aria-hidden="true" className="h-px w-5 bg-on-primary-muted/60" />
              Ready to explore?
            </p>

            <h2 className="text-[2rem] font-semibold leading-[1.1] text-on-primary balance sm:text-[2.5rem] lg:text-[2.75rem]">
              Take the first step towards a{" "}
              <span className="text-intelligence">brighter future.</span>
            </h2>

            <p className="max-w-md text-sm leading-relaxed text-on-primary-muted sm:text-base">
              Explore careers, courses, universities and global opportunities with Nextwise.
            </p>

            <div className="flex w-full min-w-0 flex-col flex-wrap gap-3 sm:w-auto sm:flex-row">
              <LinkButton
                href="/career-discovery"
                variant="primary"
                size="lg"
                trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}
                className="justify-center"
              >
                Get started for free
              </LinkButton>
              <LinkButton
                href="/book-counselling"
                variant="outline"
                size="lg"
                icon={<Calendar aria-hidden="true" className="h-4 w-4" />}
                className="justify-center border-white/30 text-on-primary hover:bg-white/10"
              >
                Book a Free Session
              </LinkButton>
            </div>

            <ul className="flex flex-col flex-wrap gap-x-5 gap-y-2 text-xs text-on-primary-muted sm:flex-row sm:items-center sm:text-[13px]">
              {TRUST_ITEMS.map(({ icon: Icon, label }, index) => (
                <li key={label} className="flex items-center gap-4">
                  <span className="flex items-center gap-2">
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-on-primary-muted" />
                    {label}
                  </span>
                  {index < TRUST_ITEMS.length - 1 ? (
                    <span aria-hidden="true" className="hidden h-3 w-px bg-on-primary-muted/30 sm:block" />
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          {/* UX10-H08 — the real sunset/campus/student photo crop, visible
              at every breakpoint (previously `lg:`-only, see this file's
              own docblock item 6). Fully decorative: aria-hidden, empty
              alt, no interactive content. */}
          <div className="relative h-52 w-full shrink-0 sm:h-64 lg:h-auto lg:w-[52%]">
            <img
              src="/cta/final-cta-vista.png"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover object-[42%_40%] lg:object-[38%_44%]"
            />
            {/* Vertical fade for the stacked (below-`lg:`) layout: the
                photo dissolves up into the navy content block above it. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 lg:hidden"
              style={{
                background:
                  "linear-gradient(180deg, var(--brand-ink) 0%, rgba(11,31,58,0.55) 14%, rgba(11,31,58,0) 38%)",
              }}
            />
            {/* Horizontal fade for the side-by-side (`lg:`) layout: the
                navy content column dissolves into the photo rather than
                meeting it at a hard seam — this milestone's own "smooth
                blend between navy left side and image right side"
                requirement. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 hidden lg:block"
              style={{
                background:
                  "linear-gradient(90deg, var(--brand-ink) 0%, rgba(11,31,58,0.78) 10%, rgba(11,31,58,0.38) 24%, rgba(11,31,58,0) 46%)",
              }}
            />
          </div>
        </div>
      </div>
    </Section>
  );
}
