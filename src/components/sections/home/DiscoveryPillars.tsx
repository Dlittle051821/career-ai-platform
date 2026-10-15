import Link from "next/link";
import { ArrowRight, Compass, Globe2, Landmark } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { HOMEPAGE_WIDE_CONTAINER_CLASSNAME } from "./homepage-layout";
import { cn } from "@/lib/utils";

/**
 * UX10A — Homepage Section 2, the four discovery cards. Each links to a
 * real, pre-existing route — no new pages introduced. "Trusted Guidance"
 * points at /book-counselling (the public, no-login-required free
 * counselling request page) rather than /trust (the Trust Center, which
 * covers data protection/escalation policy, not personalised guidance) —
 * the better match for "Get expert advice and resources you can trust."
 *
 * UX10A VISUAL POLISH PASS (correction pass #3, section 5 — "increase
 * visual punch slightly") — three scoped changes, layout/architecture
 * otherwise untouched: (1) the icon chip and icon grew one step (h-12 ->
 * h-14 chip, h-6 -> h-7 icon) for a "larger/clearer" affordance; (2) the
 * circular arrow grew one step too (h-9 -> h-10) and now sits on a
 * per-tone-tinted ring instead of a flat white-only disc; (3) each
 * card's border is now derived from its own tone's "-strong" color via
 * `color-mix` (low opacity) rather than the generic sitewide
 * `border-border/60`, so boundaries read as "this card's own color,
 * slightly more visible" rather than a uniform neutral hairline — the
 * same per-tone-border idea HeroProductPreview.tsx's dashboard cards use
 * now, for a consistent system. Richer pastel-surface + stronger title
 * color came from the shared `--surface-soft-*` tokens deepening in
 * globals.css — no change needed here, since both already read those
 * tokens via CSS variables. Saturation was deliberately NOT increased
 * (section 5's own limit) — only lightness/separation moved.
 *
 * UX10-H02 "HOMEPAGE PREMIUM VISUAL REFINEMENT" — the brief's own
 * diagnosis was "too much like four solid colored rectangles." Each
 * card's main surface moved from a flat `style={{backgroundColor:
 * style.bg}}` fill to `bg-surface` (white) with a large, soft, blurred
 * corner glow in the tone's own pale color instead.
 *
 * UX10-H03 "EXACT HOMEPAGE REFERENCE MATCH" reverses that one specific
 * choice, because this milestone's own reference image explicitly shows
 * a full pastel-tone card surface with a large illustrative icon bleeding
 * off its right edge — "pastel backgrounds," "large visual object on
 * right side," not a neutral white card with a small corner accent. Three
 * scoped changes, categories/hrefs/titles/descriptions still completely
 * unchanged: (1) the card surface is a full pastel fill again
 * (`style={{ backgroundColor: style.bg }}`), restoring the pre-H02
 * treatment the reference itself calls for; (2) the icon moves from a
 * small top-left chip to one large (h-28/h-32) disc bleeding off the
 * card's bottom-right corner, echoing the reference's big compass/books/
 * globe/advisor objects — built entirely from this codebase's own
 * existing lucide-react icon set (Compass/GraduationCap/Building2/
 * UserCheck, the same four icons OrbitJourney.tsx and the pre-H02
 * version of this file already used for the same four concepts), never
 * an external image, per the brief's own "create simple CSS/SVG visuals,
 * do not use unlicensed external images" instruction; (3) the circular
 * arrow control is kept exactly as H02 left it (bottom-right, soft-
 * shadowed, per-tone ring) since the reference shows the same control in
 * the same place.
 *
 * UX10-H04 "EXACT MATCH TO FINAL APPROVED HOMEPAGE MOCKUP" — two further
 * changes, titles/descriptions/hrefs/categories still completely
 * unchanged: (1) each card's single flat pastel fill becomes a two-stop
 * diagonal gradient using the exact hex pair this milestone's own brief
 * specifies per card (Career #EAF3FF -> #DDEBFF, Course #FDECF5 ->
 * #FBE2EF, University #E5F8EF -> #DCF3E8, Guidance #FFF3DF -> #FCEACD) —
 * these are scoped `style` values on this component only, NOT a change to
 * the shared `--surface-soft-*` tokens (still used for the small top-left
 * badge's icon color and other pages), so nothing outside this one
 * component is affected; (2) the large bottom-right icon moves from a
 * single-color, low-opacity lucide glyph to one of four original,
 * multi-tone "3D-style" illustrations (DiscoveryIllustrations.tsx — a
 * compass, a stack of books, a globe with a graduation cap, an adviser
 * figure) sized to sit fully within the card rather than bleeding off its
 * edge, matching the reference's large, fully-visible, shaded objects. The
 * small top-left badge keeps the original flat lucide icon (Compass/
 * GraduationCap/Building2/UserCheck) — still useful as a quick, legible
 * glyph alongside the bigger decorative illustration.
 *
 * A visual-QA pass at the tablet breakpoint (1024px — `lg:grid-cols-4`'s
 * own trigger, where each card is already its narrowest 4-up width)
 * caught the new illustrations overlapping the description text at
 * exactly that width. Three scoped fixes, same milestone: the
 * illustration's largest size step moves from `lg:` to `xl:` (1280px) so
 * the 1024px 4-up row keeps the smaller size instead of jumping to the
 * biggest one at its narrowest width; the description's max-width
 * tightens to `9.5rem` below `xl:` (only widening back to `11rem` once
 * the card itself has room); and each card's `min-height` grows slightly
 * (232px -> 256px) for more vertical clearance above the illustration
 * zone. Content/copy unchanged.
 *
 * UX10-H05B "EXACT TOP HOMEPAGE REFERENCE REPRODUCTION" — the brief
 * supplies real "3D-style" illustration assets directly (a compass, a
 * stack of books, a globe with a graduation cap, a guidance-character
 * figure) and explicitly instructs "DO NOT SUBSTITUTE PROVIDED ASSETS
 * WITH SIMPLER CSS ICONS." `DiscoveryIllustrations.tsx`'s four original
 * inline-SVG illustrations (H04's own stand-in, built when no such asset
 * existed) are replaced by plain `<img>` tags pointing at the four real
 * PNGs (`public/cards/career-compass.png`, `course-books.png`,
 * `university-globe.png`, `guidance-character.png`) — same sizing tiers,
 * same bottom-right placement within the card, same `min-height`/
 * description max-width tuning that fixed the 1024px overlap, just a
 * different element rendering the visual. The small top-left lucide icon
 * badge (Compass/GraduationCap/Building2/UserCheck) is unchanged — still
 * a quick, legible glyph alongside the larger decorative illustration.
 * `DiscoveryIllustrations.tsx` itself is left on disk, unreferenced, same
 * convention as every other superseded file this project keeps. Card
 * container widens from `HOMEPAGE_CONTAINER_CLASSNAME` to
 * `HOMEPAGE_WIDE_CONTAINER_CLASSNAME` — see homepage-layout.ts.
 *
 * UX10-H06 "FINAL TOP-HOMEPAGE VISUAL CORRECTION PASS" — sections 6-8.
 * The new authoritative reference (IMAGE #2) shows each illustration MUCH
 * larger than H05B's own `h-20..xl:h-28` sizing (roughly 80-112px) — close
 * to half the card's own width/height — plus a softer, more layered card
 * background (a subtle radial "lift" highlight and a low-opacity blurred
 * tone-colored glow behind the illustration, not a flat two-stop
 * gradient alone) and the circular arrow control moved from the card's
 * bottom-right corner to sit left-aligned, directly under the copy block
 * (matching the reference). Three scoped changes, same
 * categories/hrefs/titles/descriptions/tone-per-card system as every
 * prior pass:
 *
 * 1. ILLUSTRATION SCALE — each `Pillar` now carries its own
 *    `illustrationClassName`, sized per asset: the three square (1254x1254)
 *    icon-style illustrations (compass/books/globe+cap) grow to roughly
 *    40-45% of the card's own width at every breakpoint; the portrait
 *    (1086x1448) guidance-character illustration is sized by height
 *    instead (bleeding slightly past the card's own top edge, clipped by
 *    the card's `overflow-hidden`, exactly as the reference shows her),
 *    so she reads as occupying the right side of her card at full height
 *    rather than a small corner icon.
 * 2. BACKGROUND DEPTH — each card keeps its own two-stop pastel gradient
 *    (same per-card hex pairs as H04/H05B) but gains a soft white
 *    top-right radial "lift" highlight and a low-opacity, blurred,
 *    tone-colored glow positioned behind the illustration, for the
 *    reference's softer, more dimensional look — never a flat single
 *    color, never over-saturated (the base gradient hex pairs are
 *    unchanged).
 * 3. INTERNAL COMPOSITION — the circular arrow control drops its
 *    `self-end` (which pinned it to the card's bottom-right corner) and
 *    now flows as the text block's own last child, left-aligned under
 *    the title/description — matching the reference's control placement
 *    — while the illustration itself still occupies the right/bottom of
 *    the card behind it. Card `min-height` grows slightly to keep the
 *    now-larger illustrations from crowding the text at any breakpoint.
 *
 * UX10-EU02 "HOMEPAGE EUROPE ALIGNMENT" — this milestone's own brief and
 * attached reference (both "before" and "after" panels) are explicit and
 * repeated: this section becomes exactly three cards — Build Your Career /
 * Study in India / Study in Europe — not four. The previous four pillars
 * (Career Explorer / Course Explorer / University Explorer / Trusted
 * Guidance) are reduced to three:
 *  - Career Explorer is KEPT as-is (title updated to "Build Your Career"
 *    per the brief's own card heading; same /careers route, same
 *    career-compass.png illustration, same tone).
 *  - The Course Explorer and University Explorer slots are replaced by
 *    "Study in India" (-> /study-options, reusing the best existing India
 *    route per the brief's own "do not invent a route if a working one
 *    already exists" instruction) and "Study in Europe" (-> /study-europe,
 *    this milestone's own new route).
 *  - The Trusted Guidance pillar is removed from this section. This is a
 *    real, deliberate reduction in homepage surface area, not an
 *    oversight — flagged prominently in UX10-EU02_REFERENCE_AUDIT.md.
 *    Course search, university search, and counselling all remain exactly
 *    one click away via the main nav (Explore menu / Counselling link),
 *    so no route is lost, only its dedicated homepage pillar.
 *  - Per the brief's own "avoid stock-image drift if existing approved
 *    assets can be reused" instruction, and because no approved India- or
 *    Europe-specific illustration asset exists in this repo, the two new
 *    cards intentionally carry NO large bottom-right illustration image —
 *    rather than fabricate or reuse a mismatched stock visual, they rely
 *    on the same tone/gradient/icon-badge/arrow-control system every
 *    pillar already uses. `illustrationSrc` is optional on `Pillar` for
 *    exactly this reason. The icons themselves (`Landmark` for India,
 *    `Globe2` for Europe) are reused verbatim from UX10-HW01's
 *    `StudyPathwaysSection.tsx`, which already established this exact
 *    icon vocabulary for these two concepts.
 *  - Grid moves from `lg:grid-cols-4` to `lg:grid-cols-3` to match the new
 *    three-card count; `sm:grid-cols-2` intermediate tier is kept.
 */
interface Pillar {
  icon: LucideIcon;
  illustrationSrc?: string;
  illustrationAlt?: string;
  illustrationClassName?: string;
  title: string;
  description: string;
  href: string;
  tone: "soft-blue" | "soft-amber" | "soft-mint";
}

/** Sizing for the three square (1254x1254) icon-style illustrations — roughly 40-45% of the card's own width at each breakpoint. See this file's docblock, item 1. */
const ICON_ILLUSTRATION_CLASSNAME =
  "pointer-events-none absolute bottom-4 right-3 h-28 w-28 object-contain drop-shadow-md transition-transform duration-300 group-hover:scale-105 sm:bottom-5 sm:right-4 sm:h-32 sm:w-32 lg:h-36 lg:w-36 xl:h-44 xl:w-44";

/** Sizing for the portrait (1086x1448) guidance-character illustration — sized by height, bleeding past the card's own top edge (clipped by overflow-hidden), matching the reference. See this file's docblock, item 1. */
const PORTRAIT_ILLUSTRATION_CLASSNAME =
  "pointer-events-none absolute -top-5 bottom-0 right-0 h-[calc(100%+1.25rem)] w-auto max-w-[62%] object-contain object-bottom drop-shadow-md transition-transform duration-300 group-hover:scale-105 sm:max-w-[58%] lg:max-w-[56%]";

const PILLARS: Pillar[] = [
  {
    icon: Compass,
    illustrationSrc: "/cards/career-compass.png",
    illustrationAlt: "",
    illustrationClassName: ICON_ILLUSTRATION_CLASSNAME,
    title: "Build Your Career",
    description: "Discover career options that match your interests, strengths, and goals.",
    href: "/careers",
    tone: "soft-blue",
  },
  {
    // UX10-EU02 — reuses /study-options, the best existing India study
    // route (per the brief's own "do not invent a route if a working one
    // already exists" instruction), rather than a new page.
    icon: Landmark,
    title: "Study in India",
    description: "Explore career-aligned courses and universities across India.",
    href: "/study-options",
    tone: "soft-amber",
  },
  {
    // UX10-EU02 — the new Europe Country Explorer route from UX10-EU01.
    icon: Globe2,
    title: "Study in Europe",
    description: "Discover 6 leading European study destinations and trusted official sources.",
    href: "/study-europe",
    tone: "soft-mint",
  },
];

const TONE_STYLE: Record<Pillar["tone"], { bg: string; fg: string; gradientFrom: string; gradientTo: string }> = {
  "soft-blue": {
    bg: "var(--surface-soft-blue)",
    fg: "var(--surface-soft-blue-strong)",
    gradientFrom: "#EAF3FF",
    gradientTo: "#DDEBFF",
  },
  "soft-mint": {
    bg: "var(--surface-soft-mint)",
    fg: "var(--surface-soft-mint-strong)",
    gradientFrom: "#E5F8EF",
    gradientTo: "#DCF3E8",
  },
  "soft-amber": {
    bg: "var(--surface-soft-amber)",
    fg: "var(--surface-soft-amber-strong)",
    gradientFrom: "#FFF3DF",
    gradientTo: "#FCEACD",
  },
};

export function DiscoveryPillars() {
  return (
    <Section tone="default" containerClassName={HOMEPAGE_WIDE_CONTAINER_CLASSNAME} className="!pt-0 !pb-8 sm:!pb-10 lg:!pb-12">
      {/* UX10-EU02 — grid narrows from lg:grid-cols-4 to lg:grid-cols-3 to
          match the new three-card count (Build Your Career / Study in
          India / Study in Europe). sm:grid-cols-2 intermediate tier kept. */}
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PILLARS.map(({ icon: Icon, illustrationSrc, illustrationAlt, illustrationClassName, title, description, href, tone }) => {
          const style = TONE_STYLE[tone];
          return (
            <li key={title} className="h-full">
              <Link
                href={href}
                className={cn(
                  "group relative flex h-full min-h-[272px] flex-col overflow-hidden rounded-[1.25rem] border p-6 shadow-soft transition-all duration-200 sm:min-h-[296px]",
                  "hover:-translate-y-1 hover:shadow-lifted motion-reduce:hover:translate-y-0"
                )}
                style={{
                  backgroundImage: `radial-gradient(130% 110% at 88% -15%, color-mix(in srgb, white 60%, transparent) 0%, transparent 55%), linear-gradient(155deg, ${style.gradientFrom} 0%, ${style.gradientTo} 100%)`,
                  borderColor: `color-mix(in srgb, ${style.fg} 16%, transparent)`,
                  boxShadow: `0 1px 2px color-mix(in srgb, ${style.fg} 10%, transparent)`,
                }}
              >
                {/* Soft, low-opacity blurred glow behind the illustration —
                    the reference's "softer, more layered" card background
                    (never a flat single-color fill). See this file's
                    docblock, item 2. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-8 bottom-0 h-44 w-44 rounded-full blur-2xl"
                  style={{ backgroundColor: style.fg, opacity: 0.16 }}
                />

                {/* Large, fully-visible "3D-style" illustration — the
                    reference's real supplied compass/books/globe/
                    guidance-character asset, sized to roughly 40-45% of
                    the card at every breakpoint (portrait character sized
                    by height instead). See this file's own docblock,
                    item 1, for the DiscoveryIllustrations.tsx ->
                    real-asset swap and the H06 size increase. UX10-EU02 —
                    now optional: the two new India/Europe cards carry no
                    illustration (see this file's own UX10-EU02 docblock
                    entry for why), so this renders nothing for them rather
                    than an <img> with an empty src. */}
                {illustrationSrc ? (
                  <img src={illustrationSrc} alt={illustrationAlt} aria-hidden="true" loading="lazy" className={illustrationClassName} />
                ) : null}

                <div className="relative flex h-full flex-col">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-soft"
                    style={{ color: style.fg }}
                  >
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3.5 text-lg font-semibold" style={{ color: style.fg }}>
                    {title}
                  </h3>
                  <p className="mt-2 max-w-[9.5rem] text-sm leading-relaxed text-text-soft xl:max-w-[10.5rem]">{description}</p>

                  {/* Circular arrow control — left-aligned under the copy
                      block (dropped the old `self-end` bottom-right
                      pinning), matching the reference's control placement.
                      See this file's docblock, item 3. */}
                  <span
                    className="relative mt-auto flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-soft transition-all duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                    style={{ color: style.fg, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${style.fg} 30%, transparent)` }}
                  >
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
