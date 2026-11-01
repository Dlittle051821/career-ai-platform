# NW08.7 · H08 · Performance findings

Everything below was measured. No figure is estimated or invented.

## Lighthouse: production build, current homepage vs signature hero

**Method.** Lighthouse 12.6.0 (npm) ran against `next build` + `next start` on this repository at `e014164` plus NW08.7, in headless Chromium 1194 with Lighthouse's default simulated throttling (Moto G Power profile for mobile; desktop preset). There was one run per configuration, on a Linux cloud container with no GPU. The Supabase variables were placeholders (`https://placeholder.invalid`), which the existing middleware needs in order to start; so the header shows its signed-out state.

The "current" build is the default. The "signature" build set `NEXTWISE_HOMEPAGE_HERO=signature`. Both were measured on the same machine, minutes apart.

Raw reports: `evidence/homepage/lighthouse/*.json`.

| Build | Form factor | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS | Speed Index | Transfer |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Current homepage | Mobile | 59 | 96 | 100 | 100 | 1.2 s | 33.1 s | 580 ms | 0 | 3.6 s | 6,417 KiB |
| **Signature hero** | Mobile | **64** | 96 | 100 | 100 | 1.4 s | **6.3 s** | **450 ms** | 0 | 4.4 s | 6,446 KiB |
| Current homepage | Desktop | 76 | 92 | 100 | 100 | 0.3 s | 6.1 s | 10 ms | 0.004 | 0.8 s | 7,894 KiB |
| **Signature hero** | Desktop | **98** | 92 | 100 | 100 | 0.4 s | **1.1 s** | 0 ms | 0.004 | 0.9 s | 6,483 KiB |

Reading the table:
- **The signature hero does not make the homepage slower; it scored better in every run.** The current hero loads several large unoptimised PNGs as `<img>` (the campus backdrop alone is 2.4 MB). The signature hero loads the same photographs through Next.js image optimisation as WebP.
- **On both builds the LCP element is the header logo** (`nextwise-logo-horizontal.png`, a 2235×779 PNG). On mobile it accounts for about 3.0 s of load and 2.8 s of render delay. This is outside this milestone (the logo and `Logo.tsx` are untouched), but a properly sized logo would help every page.
- Most of the ~6.4 MB transfer comes from sections below the hero, which are unchanged.
- **Accessibility findings are pre-existing and not in the hero:** contrast of `text-on-primary-muted` in the final CTA, label/name mismatch on the destination cards, and the header's `/login` link name.
- These Lighthouse runs were taken before the last timing adjustment, which only moved scroll windows (`campusIn`, `campusPan`, `pathways`, `continuation`). That change has no effect on load metrics.

## The hero's own payload

| Resource | When loaded | Size (WebP via `/_next/image`, measured) |
|---|---|---|
| Portrait, wide layout (828w) | After hydration, wide screens only | 74,856 B |
| Campus, wide layout (1200w) | Only once the story passes p 0.24 | 83,206 B |
| Portrait, compact layout (640w) | After hydration, phones and tablets only | 51,526 B |
| Campus, compact layout (828w) | Only once the story passes p 0.24 | 46,334 B |
| Fraunces italic | Only on pages that render the hero (`next/font`) | one WOFF2 |

The source PNGs are 1.4 MB and 2.4 MB. Only the layout on screen fetches photographs, and the second photograph is never fetched by a visitor who doesn't scroll into the story.

There are no new npm dependencies. The animation uses `motion` 14.9.0, already installed and already used by the site.

## Runtime behaviour (browser QA, development server)

**Method.** Playwright drove headless Chromium against `next dev` at `/homepage-preview`: a continuous mouse-wheel scroll through the whole story, with `requestAnimationFrame` intervals recorded. A `PerformanceObserver` for `layout-shift` ran from load. Development mode is unminified and the compositor is software-only, so treat the frame figures as a relative baseline.

| Width | Layout shift (CLS) | Frames | Median frame | p95 frame | Frames over 50 ms |
|---|---|---|---|---|---|
| 390×844 | 0.0001 | 68 | 16.7 ms | 16.8 ms | 0 |
| 1440×900 | 0.0039 | 79 | 16.7 ms | 66.7 ms | 6 |

The slow frames at 1440 come from blending several full-screen layers (blurred shadows, the large photograph) on the CPU, as the earlier Motion Lab investigation showed for similar layers. On phones the hero uses no blur filters at all, and that run had no slow frames. **Verify on a real laptop and a mid-range Android phone** (H11 #2).

## Engineering rules applied

- Continuous animation uses only transforms (translate and scale), opacity, mask `pathLength` and `visibility` toggled at thresholds. No layout properties are animated.
- No React state changes per frame. A test fails if a motion-value handler calls a state setter, apart from the one-time photo load.
- Ribbon geometry is computed once per layout at module load, never per frame.
- No scroll, wheel or touch listeners; `useScroll` uses the browser's own scroll position, and observers and animations are cleaned up on unmount.
- Layout is reserved up front (fixed stage height, aspect-ratio art boards), so CLS stays at about 0.
