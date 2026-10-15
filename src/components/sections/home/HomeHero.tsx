import { existsSync } from "node:fs";
import path from "node:path";
import { ArrowRight, Globe2, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { LinkButton } from "@/components/ui/Button";
import { FADE_UP_CLASSES, HOVER_LIFT_CLASSES } from "@/lib/ui/motion";
import { HOMEPAGE_WIDE_CONTAINER_CLASSNAME } from "./homepage-layout";
import { OrbitJourney } from "./OrbitJourney";
import { getGraphicAriaProps } from "@/lib/graphics/accessible-graphic";
import { cn } from "@/lib/utils";

/**
 * UX10A — Homepage Section 1 (Hero).
 *
 * Reproduces the approved reference image's composition (eyebrow, two-line
 * headline with the second line in Nextwise blue, supporting copy, primary
 * + secondary CTA, three trust cues) — see
 * docs/ux10a-premium-homepage-design-system.md for the full audit this was
 * built from.
 *
 * CTAs point at real, pre-existing routes (no new pages/behavior):
 * "Explore Your Future — Free" -> /career-discovery, already documented
 * elsewhere in this codebase as "the site's primary hero CTA" (see
 * src/config/site.ts's EXPLORE_NAV docblock). "Book a Free Discovery
 * Session" -> /book-counselling, the public (no-login-required) free
 * counselling request page — not /discovery-session/book, which is the
 * *authenticated* booking page and would bounce a logged-out visitor
 * straight to /login.
 *
 * UX10-H01 "HERO ORBIT MOTION" — the right-side visual is now
 * OrbitJourney.tsx (six journey cards on a continuous, slow elliptical
 * orbit) instead of HeroProductPreview.tsx's static illustrative
 * dashboard card. HeroProductPreview.tsx's homepage USE is retired here;
 * the file itself is left on disk unmodified, per this milestone's own
 * "do not delete shared files existing tests require" instruction — see
 * OrbitJourney.tsx's own docblock.
 *
 * UX10-H01B "HERO COMPOSITION REFINEMENT" first merged the right column
 * into one `.hero-visual-stage` composition (student visual + orbit)
 * instead of OrbitJourney sitting alone, but no licensed student
 * photograph existed in the repo at that time, so it shipped a clearly-
 * marked, non-photographic placeholder slot instead and documented the
 * exact swap-in procedure.
 *
 * UX10-H02 "HOMEPAGE PREMIUM VISUAL REFINEMENT" completes that swap and
 * goes further:
 *  - The real, approved hero asset (HERO_STUDENT_IMAGE_SRC, a generated
 *    "aspirational student" image the brief supplied directly this pass)
 *    now renders as the hero's foreground subject, in `.hero-student-portrait`.
 *    This is a plain `<img>`, not `next/image` — SECTION_FILES (this file
 *    included) are asserted by homepage-source-audit.test.ts to never
 *    import `next/image`, a rule this pass keeps rather than works around.
 *    A soft CSS mask (`mask-image`/`-webkit-mask-image`, a radial fade at
 *    the frame's outer edge) blends the photo's own sky/skyline background
 *    into the hero's new atmospheric wash rather than leaving a hard
 *    rectangular photo edge — "soft blending, handled tastefully," per the
 *    brief's own instruction, chosen over an automated person-cutout/
 *    background-removal pass (no reliable segmentation tooling exists in
 *    this sandbox, and a botched silhouette would look worse than a
 *    well-blended full frame).
 *  - `HERO_STUDENT_IMAGE_EXISTS` (below) checks the asset's presence on
 *    disk at render time. If it's ever missing — e.g. a fresh checkout of
 *    this milestone's patch before the asset is copied in — the component
 *    falls back to UX10-H01B's own placeholder slot rather than silently
 *    substituting a different person or breaking the page. Nothing else
 *    about the composition changes based on this flag.
 *  - A new `.hero-atmosphere` layer (soft, large, very-low-opacity blue/
 *    cyan radial washes, blurred) sits behind the whole visual stage —
 *    the brief's own "soft premium atmospheric background... off-white/
 *    pale blue/very soft cyan... keep it very subtle, no loud gradient."
 *  - `.hero-orbit-wrap` now overlaps the student portrait on multiple
 *    sides (not just a bottom edge) so the orbit reads as flowing around/
 *    behind her rather than sitting as a separate panel below — still
 *    entirely a CSS positioning change on this wrapper; OrbitJourney.tsx
 *    itself, its keyframes, stages, copy, and routes are byte-for-byte
 *    unchanged (confirmed via `diff -q` against the UX10-H01-approved
 *    version — see UX10-H02_COMPLETION_REPORT.md).
 *  - Typography: the H1 drops one step on desktop (lg:text-[3.75rem] ->
 *    lg:text-[3.25rem]) with tighter leading, and the body copy narrows
 *    (max-w-xl -> max-w-lg) for better reading rhythm — same headline/
 *    copy text, same two-tone (navy + primary-blue) treatment.
 *  - Both CTAs pick up the already-reviewed, reduced-motion-safe
 *    HOVER_LIFT_CLASSES hover treatment (previously only used by
 *    Hero.tsx's retired predecessor) for a slightly more premium press/
 *    hover feel — no new motion primitive introduced.
 *  - Grid balance moves from `lg:grid-cols-[1fr_1.08fr]` to
 *    `lg:grid-cols-[1fr_1.15fr]` (~46/54, still inside the original
 *    UX10-H01B brief's 45-50/50-55 band) to give the now-real visual
 *    scene a bit more room now that it's carrying a real photograph, not
 *    a thin placeholder.
 * Mobile order is unchanged and already matches this milestone's own
 * requirement: eyebrow -> headline -> body -> CTAs -> trust cues -> hero
 * visual (a single-column stack below `lg:`, left column fully above the
 * right column in source order).
 *
 * UX10-H03 "EXACT HOMEPAGE REFERENCE MATCH" — the brief's reference image
 * is the target composition now, with one explicit, intentional exception
 * (the orbit replaces the reference's own straight/diagonal journey line
 * — OrbitJourney.tsx itself, its six stages, motion, timing, and routes
 * stay byte-for-byte unchanged, confirmed again this pass). Everything
 * else here moves closer to the reference:
 *  - H1 switches from this site's global serif heading treatment
 *    (`h1,h2,h3,h4 { font-family: var(--font-serif) }` in globals.css —
 *    sitewide, 65+ pages, deliberately NOT touched) to `font-sans` on this
 *    one element only. A utility class on the element itself wins over
 *    that `@layer base` rule under Tailwind v4's cascade-layer ordering
 *    regardless of selector specificity, so this is a scoped override, not
 *    a global font change.
 *  - The grid moves from `[1fr_1.15fr]` (~46/54) to `[0.82fr_1.18fr]`
 *    (~41/59) — the reference's visual column is noticeably more dominant
 *    than UX10-H01B's own earlier 45-50/50-55 band targeted (that band was
 *    tuned against an abstract placeholder-era brief, not this exact
 *    image). hero-composition-audit.test.ts's right-share assertion is
 *    updated accordingly, with the same reasoning recorded there.
 *  - The visual stage gains a real illustrated atmosphere
 *    (CampusSkylineBackdrop — pale sky, soft clouds, a campus skyline
 *    silhouette, all original inline SVG, never a stock photo — see that
 *    component's own docblock) filling the stage behind the student and
 *    orbit, instead of just two blurred color washes.
 *  - The student portrait grows substantially (roughly 56-64% of the
 *    stage width depending on breakpoint, up from ~62-64% of a much
 *    narrower column) and is now absolutely positioned, anchored to the
 *    stage's bottom-center, so she reads as standing within the scene
 *    rather than floating in a flow-positioned box.
 *  - The orbit wrapper is now absolutely positioned across the full stage
 *    (flex-centered, biased toward the upper half) instead of flowing
 *    below the portrait with a negative margin offset, so the six cards
 *    spread in a wide ring around her the way the reference's own journey
 *    nodes do — still only ever moving `.hero-orbit-wrap` as a wrapper;
 *    OrbitJourney.tsx's internals are untouched.
 *
 * UX10-H04 "EXACT MATCH TO FINAL APPROVED HOMEPAGE MOCKUP" — this
 * milestone's own final reference shows the hero as one unbroken
 * illustrated scene with no visible rectangular/circular "watermark"
 * shapes behind the photo. `<GeometricBackdrop />` (this site's generic
 * blurred-circle page-depth layer, also used on the careers/courses/
 * universities headers and career-discovery — untouched there) was the
 * source of exactly that artifact here: its two large blurred color
 * circles sat behind the whole hero grid, independently of
 * CampusSkylineBackdrop's own already-faded illustration, and showed
 * through as soft rounded color blobs overlapping the student photo and
 * the right-hand skyline in visual QA. It's removed from this section only
 * — CampusSkylineBackdrop plus `.hero-atmosphere` already provide this
 * hero's own atmospheric depth, so nothing replaces it.
 *
 * UX10-H05B "EXACT TOP HOMEPAGE REFERENCE REPRODUCTION" — this milestone's
 * brief supplies real, usable image assets directly (a transparent student
 * cutout, a campus/sky photo already faded to white at its bottom edge),
 * which changes the premise every prior pass operated under ("no licensed
 * photo exists in this repo, so build an illustrated/SVG stand-in
 * instead"). Four changes:
 *  - `CampusSkylineBackdrop` (the illustrated SVG sky/skyline) is replaced
 *    by a plain `<img>` of the real supplied photo (`/hero/
 *    campus-sky-backdrop.png`), filling the stage the same way the SVG
 *    did. The asset already fades to white at its bottom, so no CSS mask
 *    is layered on top of it.
 *  - The masked `nextwise-student-hero.png` portrait (H02's generated
 *    "aspirational student" image, cropped/faded via `mask-image` because
 *    it was a plain rectangular photo with no transparency of its own) is
 *    replaced by the real supplied cutout (`/hero/
 *    nextwise-student-cutout.png`), which is ALREADY a transparent PNG
 *    with no background to blend. The old radial `mask-image`/
 *    `-webkit-mask-image` fade in globals.css is removed for this image —
 *    masking an already-transparent cutout would just clip her silhouette
 *    for no reason — and `object-fit` moves from `cover` (cropping to fit
 *    a fixed aspect box) to `contain` (showing the whole real cutout at
 *    its own aspect ratio).
 *  - Two small handwritten-style annotation images
 *    (`/hero/annotation-clearer-brighter.png`, `/hero/
 *    annotation-curiosity-global.png`) are added, positioned near the
 *    student's upper-left and upper-right per the reference. **This is a
 *    deliberate, explicit reversal of a standing rule**:
 *    `hero-composition-audit.test.ts` has banned this exact copy
 *    ("clearer, brighter", "curiosity to global", "handwritten") since an
 *    earlier milestone decided hand-drawn annotation text didn't belong
 *    on this hero. This milestone's own brief explicitly instructs the
 *    opposite — reproduce both annotations, with explicit permission to
 *    crop them from the reference screenshot as non-interactive
 *    decorative images since no separate asset for them exists. Treated
 *    here as a deliberate, informed new instruction superseding the old
 *    one (the same way H03/H04 each reversed earlier decisions when a
 *    newer, more specific brief called for it), not an oversight — see
 *    hero-composition-audit.test.ts's own updated docblock and
 *    UX10-H05B_REFERENCE_AUDIT.md for the full reasoning. Both images were
 *    produced by chroma-keying the ink/flourish pixels out of the
 *    reference screenshot (two-factor color test: low red channel AND
 *    blue-dominant, which separates navy ink from both pale sky and dark
 *    hair) — they are cropped decorative fragments of the reference, not
 *    real HTML/text, per the brief's own asset-fallback rule limiting
 *    reference-crops to non-interactive decorative detail.
 *  - The section's container widens from `HOMEPAGE_CONTAINER_CLASSNAME`
 *    (1560px) to the new sibling `HOMEPAGE_WIDE_CONTAINER_CLASSNAME`
 *    (`min(96vw, 1600px)`) — see homepage-layout.ts's own docblock for why
 *    this is a second constant rather than widening the shared one.
 *  - **The hero's own outer structure changes from `<Section>` (which
 *    always wraps its children in one `<Container>`, constraining
 *    EVERYTHING including the background to the page's max-width) to a
 *    plain `<section>` with the backdrop photo rendered as a direct child
 *    BEFORE the `<Container>`, not inside it.** The brief's own reference
 *    shows the campus/sky photo running truly edge-to-edge of the browser
 *    viewport — behind the header-height gap, under the text column, and
 *    past the orbit on the right — not a rounded, contained panel beside
 *    the text (explicitly banned: "no ... boxed photo treatment"). Giving
 *    the photo `position: absolute; inset: 0` on a direct child of the
 *    outer (full-width, `position: relative`) `<section>` lets it stretch
 *    to cover the section's own rendered height at every breakpoint —
 *    including the stacked mobile/tablet layout below `lg:`, where it
 *    simply reads as one full-bleed band spanning both the text block and
 *    the visual-stage block beneath it — without hardcoding a pixel
 *    height or duplicating the image per breakpoint. A soft left-to-right
 *    white scrim (`.hero-backdrop-scrim`) sits directly on top of the
 *    photo, only strong on the left where the text column reads, fading
 *    to fully transparent by the time it reaches the student/orbit area —
 *    this guarantees headline/body contrast regardless of the photo's own
 *    local brightness, without ever becoming an opaque panel/box itself.
 * `OrbitJourney.tsx` itself — its six stages, motion, timing, icons,
 * copy, and routes — remains byte-for-byte unchanged this pass too; only
 * `.hero-orbit-wrap`'s position may move, and only if the new real
 * background's proportions require it.
 *
 * UX10-H06 "FINAL TOP-HOMEPAGE VISUAL CORRECTION PASS" — a correction
 * pass on top of H05B, not a rebuild (sections 1-5, 14). The new
 * authoritative reference (IMAGE #1) shows her lower body/laptop/backpack
 * sitting almost flush against the feature-cards row below, with no
 * visible seam — H05B's own `lg:pb-14` (56px) Container bottom padding
 * plus the grid's `lg:items-center` (which vertically CENTERS the visual
 * column's own fixed-min-height box within the row, rather than anchoring
 * it to the row's true bottom) was pulling her up and away from that
 * edge, reading as a mismatch between her and the background photo's own
 * ground line. Four scoped fixes:
 *
 * 1. GRID ALIGNMENT — the shared `lg:items-center` on the two-column grid
 *    is dropped; the text column keeps `lg:self-center` (so the headline
 *    block stays vertically centered against the hero's own height, same
 *    as before) while the visual column gets `lg:self-end` (so
 *    `.hero-visual-stage` — and the student bottom-anchored inside it —
 *    now sits flush with the row's own bottom edge, instead of floating
 *    centered above it).
 * 2. CONTAINER BOTTOM PADDING — the hero `<Container>`'s own bottom
 *    padding drops to near-zero (`pb-2 lg:pb-0`, down from H05B's
 *    `pb-10/pb-14`), closing the remaining gap between the content box's
 *    bottom edge and the outer `<section>`'s own true bottom (where the
 *    full-bleed backdrop photo itself ends) — this is what lets her lower
 *    edge read as aligned with the background's own lower edge (section
 *    2) rather than floating above it inside extra whitespace.
 * 3. EXPLICIT BOTTOM FADE — a new `.hero-bottom-fade` layer (a plain
 *    white gradient, viewport-height-independent, pinned to the outer
 *    `<section>`'s own bottom edge) is added as a sibling of the backdrop
 *    photo/scrim, BEFORE `<Container>` in DOM order so it paints behind
 *    the real foreground content (student/text/orbit, all inside
 *    `<Container>`, which stacks above it per this file's established
 *    paint-order pattern — see the H05B docblock above) but on top of the
 *    raw photo. The campus photo's OWN internal fade is baked into fixed
 *    pixels and shifts position under `object-fit: cover` as viewport
 *    height changes; this new layer guarantees a smooth, hard-edge-free
 *    transition into the white feature-cards section at every breakpoint,
 *    regardless of how the photo itself gets cropped — addressing
 *    section 3's "no hard rectangle edge, no sudden cutoff" directly,
 *    without touching the photo asset itself or any out-of-scope section.
 * 4. ANNOTATIONS / HEADLINE ACCENT — `annotation-clearer-brighter.png` is
 *    re-cropped from the new reference as a clean, FULLY-VISIBLE "A
 *    clearer / brighter you" (H05B's own crop was naturally truncated to
 *    "...brighter y." by the reference image it was taken from; this
 *    milestone's new reference shows the complete phrase, so the asset is
 *    replaced, same chroma-key extraction method as H05B). The right
 *    annotation ("From curiosity to global opportunities") is KEPT
 *    unchanged — this milestone's own brief requires it explicitly and
 *    repeatedly (including as a named item in its own section 20
 *    self-check gate) even though it is not visible anywhere within
 *    IMAGE #1's own captured frame; treated as the image simply not
 *    capturing that part of the design rather than evidence it should be
 *    removed, and documented as a known text-vs-image discrepancy in
 *    UX10-H06_REFERENCE_AUDIT.md rather than silently resolved either way.
 *    A small decorative two-stroke scribble accent (inline SVG, matching
 *    the reference's small blue flourish beside "possibilities.") is
 *    added directly after that word in the H1 — purely decorative
 *    (`aria-hidden`), no new copy, no change to the headline text itself.
 *    `.hero-orbit-wrap`'s own top offset is nudged slightly to keep the
 *    orbit's upper stage cards clear of the student's head now that her
 *    anchor point has moved, without changing OrbitJourney.tsx itself (its
 *    six stages/motion/timing/icons/routes remain byte-for-byte
 *    unchanged, re-verified this pass).
 *
 * UX10-EU02 "HOMEPAGE EUROPE ALIGNMENT" — a content-only pass: the hero
 * orbit is explicitly "sacred" per this milestone's own brief (do not
 * remove/replace/flatten/re-geometry it), so `.hero-visual-stage`,
 * `OrbitJourney`, the student cutout, the campus backdrop, the two
 * annotation crops, and the `lg:grid-cols-[0.82fr_1.18fr]` column split are
 * completely untouched below this point in the file. Only the left
 * column's COPY changes, to align public positioning from "global" to
 * this milestone's India + Europe launch strategy:
 *  - Headline: "Your future has possibilities. Find the right one." ->
 *    "Make smarter education decisions in India and Europe." (the brief's
 *    own preferred headline direction), keeping the same two-tone
 *    treatment (ink first line, primary-blue second line) and the same
 *    decorative scribble accent, now placed after "Europe." instead of
 *    "possibilities."
 *  - Body copy updated to the brief's own supporting copy, dropping the
 *    old "possibilities" framing's implicit worldwide promise.
 *  - Primary CTA stays the real `/career-discovery` route (this
 *    milestone's own brief: "Primary CTA: Explore Careers") — only the
 *    label changes, from "Explore Your Future — Free" to "Explore
 *    Careers". Secondary CTA moves from "Book a Free Discovery Session"
 *    (-> /book-counselling) to "Study in Europe" (-> /study-europe), per
 *    the brief's own explicit instruction to replace the hero's generic/
 *    global-destination secondary CTA with the Europe launch route.
 *    Counselling remains one click away via the main nav's "Counselling"
 *    link and the Final CTA's own secondary "Talk to an Expert" button, so
 *    this is a relocation, not a removal, of that path.
 *  - Trust cues move from "Trusted study sources / Personalised guidance /
 *    Student-first approach" to the brief's own exact four-item list:
 *    "Trusted information / Personalised guidance / Focused on India &
 *    Europe / Support at every step" — still no invented statistics, same
 *    icon-plus-label treatment, just one more item.
 * See hero-composition-audit.test.ts's own UX10-EU02 update for the
 * regression-guard side of this change (the same file that has guarded
 * every prior hero copy revision since UX10-H01B).
 */
const HERO_CAMPUS_BACKDROP_SRC = "/hero/campus-sky-backdrop.png";
const HERO_STUDENT_IMAGE_SRC = "/hero/nextwise-student-cutout.png";
const HERO_STUDENT_IMAGE_EXISTS = existsSync(path.join(process.cwd(), "public", "hero", "nextwise-student-cutout.png"));
const HERO_ANNOTATION_LEFT_SRC = "/hero/annotation-clearer-brighter.png";
const HERO_ANNOTATION_RIGHT_SRC = "/hero/annotation-curiosity-global.png";

// UX10-EU02 — the brief's own exact four-item trust row for the India +
// Europe launch positioning (replacing the three-item "Trusted study
// sources / Personalised guidance / Student-first approach" set).
const TRUST_CUES = [
  { icon: ShieldCheck, label: "Trusted information" },
  { icon: UserCheck, label: "Personalised guidance" },
  { icon: Globe2, label: "Focused on India & Europe" },
  { icon: Sparkles, label: "Support at every step" },
];

export function HomeHero() {
  const decorative = getGraphicAriaProps({ kind: "decorative" });

  return (
    <section className="relative isolate overflow-hidden bg-background">
      {/* Full-bleed backdrop — a direct child of this (full-width) outer
          <section>, BEFORE <Container>, so it spans the whole viewport
          edge to edge rather than being constrained to the page's
          max-width like everything else below. See this file's own
          docblock above. */}
      <img
        {...decorative}
        src={HERO_CAMPUS_BACKDROP_SRC}
        alt=""
        loading="eager"
        className="hero-campus-backdrop"
      />
      <div {...decorative} className="hero-backdrop-scrim" />
      {/* Explicit, viewport-independent bottom fade — see this file's
          UX10-H06 docblock, item 3. Sits behind the real content
          (Container paints after it per this file's established
          stacking-order pattern) and guarantees a smooth transition into
          the feature-cards section regardless of how `object-fit: cover`
          crops the photo itself at any given viewport height. */}
      <div {...decorative} className="hero-bottom-fade" />

      <Container
        className={cn(HOMEPAGE_WIDE_CONTAINER_CLASSNAME, "relative pt-8 pb-2 sm:pt-10 sm:pb-3 lg:pt-12 lg:pb-0")}
      >
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-14">
          <div className={cn(FADE_UP_CLASSES, "lg:self-center")}>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary">Explore · Plan · Learn · Grow</p>

            <h1 className="mt-5 font-sans text-[2.5rem] font-bold leading-[1.08] tracking-tight balance sm:text-[2.75rem] lg:text-[3.25rem] lg:leading-[1.05]">
              <span className="text-text">Make smarter education decisions</span>{" "}
              <span className="text-primary">
                in India and Europe.
                {/* Small decorative scribble accent, matching the H06
                    reference's own flourish beside "possibilities." —
                    purely decorative, no new copy. Moved to sit after the
                    new headline's own final word for UX10-EU02. See this
                    file's UX10-H06 docblock, item 4, and the UX10-EU02
                    docblock above. */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 40 22"
                  className="relative -top-3 ml-1 inline-block h-3.5 w-7 text-primary/60 sm:h-4 sm:w-8"
                >
                  <path d="M2 17 L24 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
                  <path d="M6 21 L32 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
                </svg>
              </span>
            </h1>

            {/* UX10A VISUAL POLISH PASS (correction pass #3, section 4) —
                darkened from text-muted (#5b6472) to the already-existing
                text-text-soft (#333c4d) token for "hero body copy darker".
                UX10-H02 narrows the measure (max-w-xl -> max-w-lg) for
                better reading rhythm, per this pass's own instruction —
                same copy, same color, just a tighter line length. UX10-EU02
                updates the copy itself to the brief's own India+Europe
                supporting line, same color/measure. */}
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-text-soft">
              Explore careers, compare courses and universities, and get personalised guidance for your future.
            </p>

            {/* flex-wrap rather than a breakpoint-based flex-col/flex-row
                swap: this row sits inside a partial-width lg: column, so a
                fixed "row from sm: up" rule overflowed into the hero visual
                at tablet widths (~1024px) where the column itself is
                narrower than both buttons' combined intrinsic width —
                flex-wrap degrades to a stacked layout at exactly the width
                where it's needed, at any viewport, not just below one
                guessed breakpoint. */}
            <div className="mt-8 flex flex-row flex-wrap gap-3">
              {/* UX10-EU02 — label changes from "Explore Your Future —
                  Free" to the brief's own "Explore Careers"; the real
                  route (/career-discovery) is unchanged. */}
              <LinkButton
                href="/career-discovery"
                size="lg"
                trailingIcon={
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                }
                className={`group ${HOVER_LIFT_CLASSES}`}
              >
                Explore Careers
              </LinkButton>
              {/* UX10-EU02 — secondary CTA moves from "Book a Free Discovery
                  Session" (-> /book-counselling) to the brief's own "Study
                  in Europe" (-> /study-europe), the new dedicated Europe
                  launch route. Counselling remains reachable via the main
                  nav's "Counselling" link and the Final CTA's own secondary
                  "Talk to an Expert" button. */}
              <LinkButton
                href="/study-europe"
                size="lg"
                variant="outline"
                icon={<Globe2 aria-hidden="true" className="h-4 w-4" />}
                // UX10-H05B — the shared `outline` Button variant is
                // `bg-transparent` (sitewide, used in 40+ other places,
                // deliberately not touched). Now that this button sits
                // directly on the full-bleed photo rather than a plain
                // white section background, transparent leaves its border
                // nearly invisible against the photo. `!bg-white/90`
                // (Tailwind's `!important` override, same convention this
                // project already uses for Container/width overrides)
                // scopes an opaque frosted backing to THIS button instance
                // only, without touching VARIANT_CLASSES.outline itself.
                className={cn(HOVER_LIFT_CLASSES, "!bg-white/90 backdrop-blur-sm")}
              >
                Study in Europe
              </LinkButton>
            </div>

            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3">
              {TRUST_CUES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-sm font-medium text-text-soft">
                  <Icon aria-hidden="true" className="h-4 w-4 text-secondary" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className={cn(FADE_UP_CLASSES, "lg:self-end")}>
            {/* UX10-H05B hero visual stage: the full-bleed backdrop photo
                (rendered above, outside <Container>) already fills behind
                this whole section; this stage only positions the student
                cutout, the two annotation crops, and the APPROVED orbit on
                top of it — one connected scene rather than "text column +
                separate boxed visual panel." See this file's own docblock
                above for the full-bleed/mask/fallback reasoning. */}
            <div className="hero-visual-stage relative">
              <div {...decorative} className="hero-atmosphere" />

              {HERO_STUDENT_IMAGE_EXISTS ? (
                <div {...decorative} className="hero-student-portrait">
                  <img
                    src={HERO_STUDENT_IMAGE_SRC}
                    alt=""
                    width={1086}
                    height={1448}
                    loading="eager"
                    fetchPriority="high"
                    className="hero-student-portrait-img"
                  />
                </div>
              ) : (
                // Fallback only — see HERO_STUDENT_IMAGE_EXISTS above.
                // Not expected to render once the real asset is in place.
                <div {...decorative} className="hero-student-slot" />
              )}

              {/* Reversed, documented exception to hero-composition-audit's
                  handwritten-annotation ban — see this file's own docblock
                  above. Both are decorative crops of the reference
                  screenshot, not real text, hence aria-hidden + alt="". */}
              <img
                {...decorative}
                src={HERO_ANNOTATION_LEFT_SRC}
                alt=""
                loading="eager"
                className="hero-annotation hero-annotation-left"
              />
              <img
                {...decorative}
                src={HERO_ANNOTATION_RIGHT_SRC}
                alt=""
                loading="eager"
                className="hero-annotation hero-annotation-right"
              />

              <div className="hero-orbit-wrap">
                <OrbitJourney />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
