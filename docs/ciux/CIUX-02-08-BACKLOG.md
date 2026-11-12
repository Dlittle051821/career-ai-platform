# CIUX-02 to CIUX-08: Backlog (deliverable I)

Each phase starts only after the previous one is reviewed. All phases build on the CIUX-01 tokens, buttons and navigation; none touch CC-26 protected areas.

## CIUX-02: How It Works and the first-visit journey (recommended next)

Why first: it is the second most visited explanation page, it is the "How it works" menu's first link, and it currently mixes blue and orange CTAs with a Europe-only H1 ("From your goals to the right opportunity in Europe") although Nextwise covers India and abroad.

Scope:
- Rewrite `/how-it-works` as one clear sequence (discover → explore → decide → apply), with the free Discovery Session as the single primary action.
- Align the H1 with the homepage promise (India and abroad).
- Connect it to `/book-counselling` and the Discovery Session flow; check that the booking page's copy matches.
- Replace local uppercase eyebrows and hero button overrides with the shared components.
Start point: `src/app/(site)/how-it-works/page.tsx`, `src/components/sections/how-it-works/*`, `HowItWorksHero.tsx`.

## CIUX-03: Careers and Career Intelligence

`/careers`, `/career`, `/career-discovery`, `/compare`. Unify search and filters into shared field components, a shared Tabs component, consistent career cards (FeatureCard family), result empty and error states.

## CIUX-04: Universities, courses and study options

`/universities`, `/courses`, `/courses/compare`, `/study-options`. Teal chip filters to the token chip style, comparison tables at 360 px, card density on mobile.

## CIUX-05: Study abroad

`/abroad`, `/study-europe` and destination pages. One destination template, cost and intake blocks, the "Talk to an expert" path to the Discovery Session.

## CIUX-06: Free Resume Builder (blocked)

No resume route, component or data model exists. Needs a product decision (scope, storage, export format, privacy) before design. Must not be linked from navigation until it works. When built, add it to the Free tools menu and QuickExplore.

## CIUX-07: Trust, pricing, parents, about, contact form

- `/pricing`, `/parents`, `/about`, `/trust` page passes.
- Legal pages need final text from counsel (currently placeholders).
- A real contact form only with an approved provider and sender; until then the mailto composer stays.
- Confirm mailbox delivery for both founder addresses.

## CIUX-08: Authenticated workspaces

Student Studio, dashboard, counsellor and admin workspaces, auth screens. Visual pass only (tokens, buttons, empty states, tables); no change to auth, RLS, counsellor authorization, entitlements or payments. Sequence after CC-26 QA acceptance.

## Cross-cutting items

- Remove the 137 local `uppercase tracking-wide` labels as each page is redesigned.
- Retire unreferenced V4 homepage components when the owner confirms they are no longer a fallback.
- Admin chart palette and `BRAND_DARK_BG` metadata colour.
- Odia language: content and a real switcher, or keep "coming soon".
- Real-device and screen-reader testing per phase.
