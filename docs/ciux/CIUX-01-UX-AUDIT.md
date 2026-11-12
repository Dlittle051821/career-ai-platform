# CIUX-01: Route-by-route UX audit and coverage (deliverables B and F)

Method: the baseline build (cc26 `8659828`) and the CIUX-01 build were run side by side and every route was measured at 1440 px (button styles, headings, contact links, placeholder text, overflow), then at 360/390/768/1024/1440 px for overflow and target sizes, with axe-core (WCAG 2.0/2.1/2.2 A and AA) at 390 and 1440 px.

## Findings before CIUX-01 (baseline)

Site-wide:

1. **Two design languages.** The homepage used navy, ocean and coral pill buttons; every other page used UX10 blue `#2563EB` buttons with a 10 px radius, orange `#D97F22` and teal `#0D7D6F` accents, and a purple token. Moving from the homepage to any page felt like a different product.
2. **Navigation.** A flat row of six links; Pricing, Parents, About, Trust, Contact and the free session were not in the header at all. The homepage had its own separate four-link map nav.
3. **Contact.** No `mailto:` or `tel:` link anywhere; "Email support — coming soon"; illustrative support hours; the contact form showed success without sending anything.
4. **Accessibility.** 132 axe colour-contrast failures across the public routes (mostly `#2563EB`-on-pale and orange text).
5. **Footer.** UX10 blue band with "coming soon" contact lines.
6. Language selector offered Odia, which has no content.

Per route (baseline, 1440 px):

| Route | H1 | Main issues |
|---|---|---|
| `/` | Too many choices. One clearer direction. | Approved; header nav limited to 4 links; no route-out section after the story |
| `/how-it-works` | From your goals to the right opportunity in Europe | Blue and orange buttons on one screen; uppercase eyebrows |
| `/career` | Discover multiple possibilities for your future | Blue pill and orange square buttons mixed |
| `/careers` | Explore Career Paths | Blue buttons; uppercase eyebrow; ocean-on-grey label at 4.36:1 |
| `/career-discovery` | Understand your direction before you choose a course | Three button styles |
| `/compare`, `/courses/compare` | Compare … side by side | Blue buttons; low-contrast eyebrow |
| `/universities`, `/courses` | Browse … | Teal filter chips, blue buttons; low-contrast eyebrow |
| `/abroad`, `/study-europe` | Your global education journey / Explore Europe | Blue and orange CTAs together |
| `/study-options` | Comparing India and abroad, honestly | Orange CTA; "ILLUSTRATIVE" figures (correctly labelled) |
| `/pricing` | Plans for every journey | Blue CTA; "placeholder" legal text |
| `/about`, `/parents`, `/trust` | … | Orange CTAs; trust escalation contact was a demo notice |
| `/contact` | Get in touch | Fake-success form; illustrative hours; no real contact |
| `/privacy`, `/terms`, `/refund-policy` | … | Placeholder legal text (needs counsel); no contact |
| `/book-counselling` | Book your free Discovery Session | Blue button; works publicly |
| `/login`, `/register`, `/forgot-password` | … | Blue buttons |
| `/roadmap`, `/saved`, `/discovery-session/book`, `/welcome` | (redirect to login) | Auth-gated; show the login screen |

## After CIUX-01

- Every route's buttons now come from one system: coral pills with navy text for the main action, navy or outline pills for the rest (measured on all 28 routes).
- Header, footer, page hero and section headings are shared and token-driven on every public route.
- axe: **0** violations on all 23 public routes at 390 and 1440 px (baseline 132 nodes).
- No horizontal overflow at 360, 390, 768, 1024 or 1440 px on any of the 23 routes (115 checks).
- All header, menu and footer targets are at least 24 px; menu rows are 44 to 52 px.
- Contact links on every page (footer), five on `/contact`.

## Route coverage matrix (F)

"Shared" = inherits the new header, footer, tokens, buttons, `PageHero`/`SectionHeading`. "Page redesign" = layout and content work deferred to CIUX-02..08, as the brief requires review of this foundation first.

| Route | Shared foundation | Page-specific change in CIUX-01 | Page redesign phase |
|---|---|---|---|
| `/` | Header nav integrated; footer | QuickExplore section after the story; story unchanged (pixel-identical) | Not planned (approved homepage) |
| `/how-it-works` | Yes | None | CIUX-02 |
| `/careers`, `/career`, `/career-discovery`, `/compare` | Yes | None | CIUX-03 |
| `/universities`, `/courses`, `/courses/compare`, `/study-options` | Yes | None | CIUX-04 |
| `/abroad`, `/study-europe` | Yes | None | CIUX-05 |
| `/pricing` | Yes | CTA band buttons | CIUX-07 |
| `/contact` | Yes | Rebuilt with official contacts | Done in CIUX-01 |
| `/parents`, `/about` | Yes | None | CIUX-07 |
| `/trust` | Yes | Escalation contact | CIUX-07 |
| `/privacy`, `/terms`, `/refund-policy` | Yes | Contact link | Needs legal text (owner/counsel) |
| `/book-counselling` | Yes | None | CIUX-02 (journey) |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Yes (buttons, tokens) | None; no auth logic touched | CIUX-08 |
| `/dashboard`, `/studio`, counsellor and admin workspaces | Tokens and buttons only (shared `Logo`, `Button`) | None | CIUX-08 (documented, not redesigned) |
| `/pay`, `/payments`, `/agreements`, `/applications`, `/profile` | Tokens only | None; payment and entitlement logic untouched and still off | Out of scope until CC-26 QA |

## Known remaining page-level issues (for later phases)

- 137 component files set their own `uppercase tracking-wide` labels.
- Several heroes still use local `HOVER_LIFT_CLASSES` and `!bg-white/90` overrides on outline buttons.
- Legacy V4 homepage components (`HomeHero`, `HomeFinalCTA`, `OrbitJourney`, …) remain on disk, unreferenced by `/`; one still has a `#2563EB` gradient stop.
- Admin chart colours (`CommandCentreWidgets.tsx`) still use the UX10 blue family.
- `BRAND_DARK_BG` in `site.ts` is still the UX10 navy `#0b1f3a` (used for metadata); review with the PWA/OG images.
- Homepage CLS 0.127 at 1440 px exists in the baseline too (the V5.4 intro); not changed by CIUX-01.
