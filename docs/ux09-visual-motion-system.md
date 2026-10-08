# UX09 — Visual & Motion System

This document covers Part B (visual polish), Part C (the Nextwise-native
graphics system), and Part D (the motion system) of the UX09 task, plus
the favicon fix. The first version of this document (delivered in an
earlier pass of this same package) disclosed that Parts B/C/D had not
been substantially attempted — this revision replaces that disclosure
with what was actually built, since the follow-up task required
completing that work rather than leaving it deferred.

As before: this environment has no live browser attached to a running
dev server with real data, so nothing below is claimed as rendered
visual QA — only build-output inspection (compiled HTML grepped after
`npm run build`), static class/token inspection, and test-verified logic
are used as evidence, and each claim says which of those it is. Where a
real layout bug was found during that static self-audit (one was — see
"A bug this self-audit caught" below), it is disclosed and fixed, not
smoothed over.

## What this pass actually delivered for Parts B/C/D

- **A small, reusable graphics system** (`src/components/graphics/`):
  three components (`PathwayGraphic`, `NetworkGraphic`,
  `GeometricBackdrop`) plus one shared accessibility helper
  (`src/lib/graphics/accessible-graphic.ts`). All three are pure inline
  SVG/CSS — no raster image, no external asset, no new dependency.
- **A small motion system** (`src/lib/ui/motion.ts` + two new keyframes
  in `globals.css`): a one-shot fade-up entrance, a hover-lift for CTAs,
  and a slow ambient "flow" animation along a pathway's connecting line
  — the task's own named example of acceptable ambient motion. No
  animation library was added (none existed in the baseline; the
  dependency audit below confirms this).
- **Real visual changes on every page the task named**: the homepage
  hero, the student dashboard, `/career-discovery`, `/careers`,
  `/courses`, `/universities`, `/applications`, and
  `/applications/[id]`. Every change is described per-page below, with
  what was deliberately left untouched and why.

What this pass did **not** do, on purpose: redesign any card's content,
touch any admin route beyond what Part A already covers, add a second
rules engine for application/stage state (every "truthful" visual below
re-labels or re-groups a value that already exists — see each section),
or add any image, video, canvas/WebGL, or 3D library.

## Dependency audit (Part D, done first)

Checked `package.json`/`package-lock.json` before writing any motion
code: no `framer-motion`, `motion`, `gsap`, or any other animation
library exists in this baseline (confirmed again for this pass — both
files are otherwise untouched, zero new dependencies). Per the task's
own instruction, this means CSS/Tailwind/keyframes is the only acceptable
approach, which is what every animation in this pass uses.

## The graphics system (Part C)

Three components, not five — the task's own guidance ("do not create
five components if two or three well-designed reusable ones can cover
the product") is followed literally:

- **`PathwayGraphic`** (`src/components/graphics/PathwayGraphic.tsx`) — a
  row (or column) of nodes connected by a line, each node in one of
  exactly three states: `done` / `current` / `upcoming`. The component
  never computes this state itself — every caller passes it in from a
  value that already exists elsewhere (see "truthful, never invented"
  below). Supports an optional single animated "flow" segment (the one
  edge leading into the `current` node — never every edge at once) and
  an optional staggered fade-in entrance (`entrance` prop, default
  `false` — left off wherever multiple instances could render on screen
  together, so a long list never fades in all at once).
- **`NetworkGraphic`** (`src/components/graphics/NetworkGraphic.tsx`) —
  an abstract "one center, several directions" radiating-node graphic,
  used wherever the page's own subject is branching possibility rather
  than a fixed sequence (career discovery). Deliberately abstract: it
  never claims to represent a specific career, course, or university.
- **`GeometricBackdrop`** (`src/components/graphics/GeometricBackdrop.tsx`)
  — a decorative background layer combining a soft color wash (the exact
  blur-circle treatment the pre-existing `Hero.tsx` already had, now
  shared) and/or a very faint (3.5% opacity) rotated line pattern, for
  the "thin geometric pattern" / "light accent wash" surface depth the
  task's PAGE DEPTH section asks for. Always unconditionally
  `aria-hidden` — there is no meaningful variant of a background, so
  unlike the other two it does not take a `GraphicAccessibility` prop at
  all.

### Accessibility, centralized once

`src/lib/graphics/accessible-graphic.ts` exports one pure function,
`getGraphicAriaProps()`, that both `PathwayGraphic` and `NetworkGraphic`
call rather than each hand-rolling their own aria ternary. A caller
passes `{ kind: "decorative" }` (gets `aria-hidden="true"` and nothing
else) or `{ kind: "meaningful", label: "..." }` (gets `role="img"` plus
that label, never `aria-hidden`). Every component's own internal visual
markup is additionally always hardcoded `aria-hidden="true"`, so a
`role="img"` usage exposes exactly one accessible name, never a
double-narrated subtree. Covered by 4 unit tests
(`src/lib/graphics/accessible-graphic.test.ts`) plus a static source-text
audit (`src/lib/graphics/graphics-source-audit.test.ts`, 19 tests) that
checks, by reading the component files as text: no external image URL,
no `<img>`/`next/image`, no reference to any `/brand/` or
`nextwise-icon`/`nextwise-logo` asset path (the logo-imitation rule), and
that the aria helper is actually used rather than bypassed.

### Never imitates the logo

None of the three components references, imports, or derives from any
file under `public/brand/` — confirmed both by code review and by the
source-audit test above, which fails if any graphics file ever starts
referencing a brand asset path. Nothing here is built to resemble the
Nextwise "N" mark; all three are generic geometric/node motifs.

## The motion system (Part D)

`src/lib/ui/motion.ts` exports the system as named class-string
constants (never raw strings copy-pasted into five page files) plus one
small pure helper:

- `FADE_UP_CLASSES` — a single, non-repeating 500ms fade-and-rise for
  entrance content (hero copy, page headers, the first card on a page).
- `HOVER_LIFT_CLASSES` — a 200ms hover/focus elevation for a primary CTA.
  Deliberately uses `transition-all` rather than a `transition-[...]`
  property list — `transition-property` is a single CSS property, and
  this codebase's own `Button.tsx` `BASE_CLASSES` already sets
  `transition-colors`; two utility classes each setting a different
  explicit property list on the same element would silently overwrite
  each other rather than compose. `transition-all` composes with the
  existing color transition instead of fighting it (documented in the
  module's own comment, since it is exactly the kind of mistake that is
  easy to reintroduce later).
- `FLOW_DASH_CLASSES` — the slow (6s), low-amplitude ambient motion along
  an SVG path's stroke, the task's own named "gentle pathway animation"
  example.
- `getStaggerDelayMs(index, stepMs, maxItems)` — a pure function
  returning a capped, linear per-item delay, so a long list's entrance
  never becomes a sluggish cascade (capped at 6 items by default).
- `UI_TRANSITION_DURATIONS_MS` — the actual durations this module hands
  out, asserted by its own test to sit inside the task's own stated
  150-500ms band for one-shot UI transitions (ambient motion is
  intentionally excluded from that check — the task puts ambient motion
  in its own, separately-governed "used sparingly" category).

All of this is covered by `src/lib/ui/motion.test.ts` (7 tests): every
constant's `motion-reduce:` guard is checked directly, including the
specific failure mode a bare `motion-reduce:animate-none` would have
(freezing the element at its 0%-opacity starting keyframe rather than
showing it) — the fade-up guard explicitly resets opacity/transform too.

### Reduced motion — explicit, not just relied upon

This project already had a blanket `@media (prefers-reduced-motion:
reduce)` rule in `globals.css` that zeroes every animation/transition
duration and caps iteration count at 1. That rule alone would already
make `.animate-fade-up` and `.animate-flow-dash` stop animating — but
collapsing a keyframe to a near-0ms single pass only *looks* right if its
100% frame is an acceptable resting state, and the task's own instruction
is explicit: "do not rely only on a generic existing rule without
verifying it actually covers each new animation." So this pass adds two
explicit overrides inside that same media block:

```css
.animate-fade-up { animation: none; opacity: 1; transform: none; }
.animate-flow-dash { animation: none; }
```

`.animate-fade-up` is guaranteed to render fully visible with no
animation at all under reduced motion, rather than trusting that a
~0ms single pass lands exactly on its end state. `.animate-flow-dash`'s
infinite ambient loop is switched off outright. Both overrides, and the
fact that every graphics-system component only ever applies
`.animate-flow-dash` through the already-guarded `FLOW_DASH_CLASSES`
constant (never as a bare class name), are checked by
`graphics-source-audit.test.ts`.

`HOVER_LIFT_CLASSES` uses the same `motion-reduce:` Tailwind-variant
convention this codebase's own `Button.tsx` loading spinner already
established (`animate-spin motion-reduce:animate-none`) — this pass
extends an existing, already-reviewed pattern rather than inventing a
second one.

## Per-page changes

### Homepage (`/`)

`Hero.tsx`'s two one-off absolutely-positioned blur-circle `<div>`s were
replaced with the shared `<GeometricBackdrop />` (same visual result,
now reusable) and the hero text column gets the fade-up entrance.
`RoadmapVisual.tsx` (the existing, already-labeled "Illustrative journey"
roadmap graphic — Interests → Career direction → Course & pathway → Job
readiness) keeps its four stages and their order unchanged; each node
now fades in on a short stagger, and exactly one connecting segment (the
journey's conceptual midpoint) carries the ambient flow motion — not
every segment, so the graphic reads as calm rather than busy. The
primary "Find My Direction" CTA gets the hover-lift. The homepage's own
content and copy were not rewritten.

### Student dashboard

The existing, already-real "Your journey" stepper
(`JourneyProgress.tsx`/`computeJourneyProgress()`, Milestone/UX04 —
Explore → Build Profile → Recommendations → Saved Options → Decide →
Apply, each stage's state genuinely derived from the student's own data)
was deliberately left untouched: it already does exactly what this
task's "Where am I / what's next" instruction asks for, including the
documented reasoning for why it never shows a fabricated aggregate
percentage. Redesigning an already-correct, already-tested component
would be the opposite of the Part A discipline this package already
established ("improve only presentation, never re-derive"). What
changed instead: a restrained `GeometricBackdrop` (color-wash only, no
grid texture, at reduced opacity) sits behind the greeting/next-step
area only, and both the greeting and the "Your next step" card fade in;
the next-step CTA gets the hover-lift.

### Career discovery

`PageHero` (the shared inner-page hero used by 16 pages across this
product) gained one new, entirely optional `visual` prop — every one of
its other 15 call sites (payments, legal, contact, pricing, etc.) is
unaffected, since they simply don't pass it. `/career-discovery` passes
a decorative `NetworkGraphic` beside its title on desktop, illustrating
"many directions from one starting point" — matching the page's own
copy about discovering a direction. No scoring, matching, or AI-sounding
language was added anywhere near it.

### Careers / Courses / Universities

All three list pages get the same restrained treatment: a faint
`GeometricBackdrop` (grid-only, no color wash, 3.5% opacity) behind the
page, and the header text fades in. Neither the filter bars, the result
cards, the pagination, nor the empty-state logic were touched — per the
task's own "do not make every card animated" instruction, no hover or
entrance motion was added to the result cards themselves (`CareerCard`,
`CourseCard`, `UniversityCard`), since none of them are the whole-card
clickable surface the way a hover-lift implies.

### Applications (list)

The real, existing four-bucket grouping (`Active` / `Submitted` /
`Decision` / `Closed`, from `getApplicationBucket()`, Milestone 16) is
unchanged — this pass did not touch its logic, only pulled its ordering
out into one shared export (`APPLICATION_BUCKET_ORDER`) so the page and
the card below can agree on it without duplicating the array. Each
`ApplicationCard` now shows a compact, non-animated `PathwayGraphic` of
that same four-bucket sequence, with the application's own real bucket
marking the `done`/`current`/`upcoming` split — truthful because it is
the exact value already computed for the existing status badge, never a
second classification. It is deliberately **not** shown for a `rejected`
or `withdrawn` application: `closed` covers both a genuine success
(`enrolled`) and a non-success outcome, and a filled, checkmarked
pathway reads as "completed successfully" — true for the former,
misleading for the latter. For those two stages the card keeps its
existing, already-correctly-toned status badge instead of adding a
pathway that would overstate the outcome. The pathway's single animated
segment is turned off here (`animateActiveSegment={false}`) specifically
because this page can render many cards at once — one calm, static
graphic per card, not several moving lines competing for attention.

### Application detail (`/applications/[id]`)

The existing `ApplicationTimeline` component (Milestone 16's discrete,
non-percentage five-step timeline — Started/Preparing/Submitted/Under
review/Decision, deliberately vertical at every breakpoint to avoid
overflow at 375px) was left completely untouched — it is already exactly
what this task's "Started/Preparing/Documents/Ready/Submitted" guidance
describes, including its own documented reasoning for staying vertical
and for never fabricating a percentage. The page header fades in, and
the "Next step" card gets the same accent border/background treatment
(`border-primary/15 bg-primary/[0.03]`) the dashboard's own "Your next
step" card already uses, so the one card answering "what do I do right
now" is visually dominant rather than competing equally with the
submission-record card above it. No background graphic was added to
this page — the task's own instruction here is explicit ("stronger
visual rhythm... without becoming decorative"), and a page this
information-dense is exactly where restraint matters most.

## A bug this self-audit caught

While auditing the new `PageHero` `visual` prop's responsive classes
(as part of the task's own "verify, don't just assert, responsive
behavior" instruction), this pass found and fixed a real layout bug
before it ever reached the package: the wrapping `<div>` was given both
`space-y-6` (margin-top between stacked children, active at every
width) and, when a `visual` was present, `grid gap-8
lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12` — both class lists
active simultaneously rather than one replacing the other. At `lg` and
above, the grid places the text and visual columns side by side in the
same row, and `space-y-6`'s margin-top on the second grid item would
have pushed the visual column down relative to the text column,
misaligning them. Fixed by making the two class lists mutually
exclusive (`hasVisual ? "grid gap-8 ..." : "space-y-6"`) rather than
concatenated — confirmed via `npx tsc --noEmit` and a fresh
`npm run build`, both clean, after the fix. This is exactly the kind of
thing a real responsive audit is supposed to catch, and is disclosed
here rather than silently fixed, per the task's own honesty standard.

## Favicon implementation (carried over, unchanged, still fully delivered)

Nothing about the favicon fix changed in this pass. Restating the
essentials for completeness; see the original writeup for full detail
and evidence — this pass re-ran the same build-output check and got the
same result.

**Problem:** `src/app/icon.svg` was a stale, pre-rebrand placeholder
glyph (`git log --oneline -- src/app/icon.svg` shows only "M1 - Website
foundation complete") that browsers were silently preferring over the
already-correct `src/app/icon.png`, because Next.js's icon resolution
puts SVG ahead of PNG when both exist.

**Fix:** deletion only — `src/app/icon.png` and `src/app/apple-icon.png`
were already byte-identical (SHA-256) to the approved
`public/brand/nextwise-icon-256.png` and
`public/brand/nextwise-apple-touch-icon.png`. No symbol was redrawn,
recolored, or approximated.

**Verification (build-output inspection, re-confirmed in this pass):**
after `npm run build`, the compiled `<link rel="icon">` tags resolve to
`favicon.ico` → `icon.png` only, with no `icon.svg` tag — because the
file no longer exists for Next.js to discover.

**Regression guard:** `src/config/favicon-brand-consistency.test.ts` (5
tests, still passing) enforces: `icon.svg` stays deleted;
`icon.png`/`apple-icon.png` stay byte-identical to the approved source;
`favicon.ico` stays present; `manifest.ts` keeps referencing
`BRAND_LOGO.icon192`/`icon512` and never a raw `icon.svg` path.

## Approved logo asset path (unchanged)

Still centralized in `src/config/site.ts`'s `BRAND_LOGO` constant —
`icon` → `/brand/nextwise-icon.png`, `icon192`/`icon512` → the manifest
sizes, `horizontal`/`horizontalDark` → the full wordmark lockups,
`socialShare` → the Open Graph image. No file under `public/brand/` was
added, removed, or modified by this pass or the one before it. The
graphics system introduced in this pass never references any of these
paths — confirmed by the source-audit test described above.

## Performance

No new dependency was added (confirmed again: `package.json`/
`package-lock.json` diff against the real baseline is unchanged by this
pass beyond what Part A already touched — actually, this pass touches
neither file at all). Every graphics component is inline SVG/CSS — zero
new images, zero new fonts, zero new client-side JavaScript (`useId()`
is the only React hook used anywhere in the three graphics components,
and it works in Server Components; none of the three graphics files or
`motion.ts` carries a `"use client"` directive). The two new CSS
keyframes add a few lines to `globals.css`; nothing else changes bundle
size in any measurable way.

## Responsiveness

Checked via static class inspection (no live browser in this
environment — stated plainly, not labeled as rendered QA) at the
375/768/1024/1440 breakpoints the task names:

- `PageHero`'s new visual column is `hidden` below `lg` (1024px) and
  only appears at `lg`/1440px — it never competes for space on a phone
  or tablet width, and (after the fix above) no longer double-applies
  conflicting spacing utilities at the breakpoint where it does appear.
- `GeometricBackdrop`'s grid-texture variant sits at 3.5% opacity behind
  solid `bg-surface` cards (confirmed via `Card.tsx`), so it is only
  ever visible in the gaps between elements, never competing with
  on-top content at any width.
- `PathwayGraphic` stacks vertically (`flex-col`) below the `sm`
  breakpoint (640px, covering 375px) and switches to a horizontal row
  only at `sm` and above — the same responsive pattern the pre-existing,
  already-shipped `RoadmapVisual` used, just generalized into a reusable
  component.
- No new horizontal-scroll risk was introduced: every new element either
  stacks vertically on narrow widths or is hidden below a breakpoint
  where it would not fit.
