# NW-V4 Connected Experience: homepage implementation

`/` now renders the approved **V4 Connected Experience**. It is one pinned, scroll-driven story guided by the official N:

1. Intro
2. Two Pathways
3. Career Intelligence
4. Study Abroad
5. Student Studio
6. Trust & Guidance
7. Final conversion

The opening hero uses the approved mockup's own scene: the student with the backpack looking up, the sunrise, the layered mountains and the European university, in the Nextwise blue-grey palette. It fills the whole stage and continues behind it, so no viewport shows dark letterbox bands.

## Design sources (priority as briefed)

| Element | Source |
|---|---|
| N reveal, N geometry and material, scroll choreography, every scene after the hero, typography, buttons, cards, layout, gradients, timings, desktop and mobile compositions | V4 Connected Experience (master) |
| Hero scene (student, sunrise, mountains, university), its palette and atmosphere | Approved homepage mockup (final background integration) |
| Hero headline, sub-copy, CTAs, free-session card, N rest position | V4 Connected Experience. Option chosen: "Scene + V4 hero layout" |
| Image resolution and gradient smoothness | Production rebuild (this implementation) |

## Files

| File | Role |
|---|---|
| `src/app/(site)/page.tsx` | Renders `<V4ConnectedHome />`. Keeps the existing `publicPageMetadata("/", …)`. |
| `src/components/sections/home/v4/V4ConnectedHome.tsx` | Client component. Renders the 1:1 markup of the prototype and starts the engine once. |
| `src/components/sections/home/v4/v4-home.css` | Port of the prototype stylesheet. Every rule is scoped under `.nw4`; the only exception is the homepage-only header capsule, scoped by `body:has(.nw4)`. |
| `src/components/sections/home/v4/V4Picture.tsx` | Art-directed `<picture>` with AVIF/WebP ladders and stage-aware `sizes`. |
| `src/components/sections/home/v4/fonts.ts` | The true italic cut of Fraunces. Loaded on the homepage only. |
| `src/lib/home/v4/engine.ts` | Framework-free stage engine. All timings, easings, N positions and transition rules are carried over unchanged. |
| `src/lib/home/v4/content.ts` | Destinations, routes and copy. |
| `src/lib/home/v4/images.ts` | Generated responsive image sets and `sizes` helpers. |
| `src/lib/home/v4/v4-home.test.ts` | 22 tests covering routes, content integrity, choreography constants, assets and CSS scoping. |
| `public/home-v4/*` | 117 optimised images plus `dither-256.png`. |

## How it differs from the prototype (plumbing only, no visual redesign)

- **Navigation.** The prototype's in-stage nav capsule is replaced by the real site `Header`, unchanged in code: navigation, account menu, language selector and mobile menu all work. On `/` only, CSS styles it as the V4 light glass capsule, aligned to the stage's 40 px (desktop) or 14 px (mobile) inset. It fades in with the intro at 3.5–4.4 s, exactly as V4's nav did. Its links are the site's real primary navigation, not the prototype's placeholder labels.
- **Footer.** The site `Footer` follows the story, as on every page. The final scene keeps V4's small footer row, now linked to `/privacy`, `/terms` and `/contact`.
- **Links.** Every CTA points to a real route:

  | CTA | Route |
  |---|---|
  | Hero and pathway buttons | Scroll to their scene, as in V4. Real `href`s to `/careers` and `/abroad` cover middle-click and no-JS. |
  | Explore Careers | `/careers` |
  | Compare careers | `/compare` |
  | Save to Studio, Invite | `/register?next=/studio` |
  | Talk to an adviser, free-session card, Book a Free Discovery Session | `/book-counselling` (the public free Discovery Session entry) |
  | Explore programmes | `/courses?destination=XX` (the launch-country filter) |
  | Open the full University Explorer | `/universities` |
  | How guidance works | `/how-it-works` |
  | Create a Free Account | `/register` |
  | Official source | The country's official site, opened in a new tab |

- **Programme search.** The search bar in the Study Abroad scene is a real GET form to `/courses` (`q` plus `degree=bachelors|masters`). In the prototype it was a static picture of a search field.
- **Accessibility.**
  - Hidden scenes leave the accessibility tree.
  - Tablists follow the WAI-ARIA tabs pattern (roving `tabindex`, arrow/Home/End keys).
  - A visually hidden "Homepage sections" link list, visible on focus, lets keyboard and screen-reader users jump to any scene.
  - Focusing an element brings its scene to rest.
  - `prefers-reduced-motion` uses V4's own reduced mode: crossfades, no travel, no smooth scroll.
- **Viewport.**
  - The stage scales against `clientWidth` and `100svh` instead of `innerWidth`/`innerHeight`, so desktop scrollbars no longer crop the stage edges.
  - Mobile toolbars appearing or hiding no longer rescale the stage mid-scroll.
- **Performance.** Frames are only drawn while something moves: during the intro, scroll smoothing or a switch animation. At rest the engine is idle.
- **First paint.** The stage stays hidden until the engine has drawn frame 0. That matches the intro's first 650 ms (an empty dusk stage), so nothing flashes. `<noscript>` reveals a static hero.
- **QA hook.** `?nw4-capture` exposes `window.__nw4Frame(ms, t, opts)` for frame-accurate screenshots and videos. It only freezes that one visitor's own animation.

## Hero scene: final background

- **Source.** The approved homepage mockup's own photography, extracted with every piece of UI, text and the ribbon N removed (see `ASSET-MANIFEST.md`). No other student, castle or landscape photograph is used.
- **Layout.** `.h-photo` now covers the full stage (1440 × 900 desktop, 390 × 844 mobile) with no side mask and no dark scrim. Copy, CTAs, the free-session card and the N rest position are unchanged.
- **Palette.** Canvas `#F9F9FC`, Mist `#D4D9E1`, Slate `#7D8EA6`, Steel Blue `#344D7D`, Deep Blue `#1A3262`, Charcoal `#282A2D` (CSS variables `--nw-*` on `.nw4`). Only L0 uses them: pale sky ground, Deep Blue headline with "Next." in Steel Blue, Charcoal body copy, a solid Deep Blue primary button, a Deep Blue outline secondary button, a light glass free-session card, and a neutral intro glow. All later scenes keep their V4 styling.
- **Bleed layer.** `[data-nw4-bleed]` sits inside the sticky container behind the stage. The engine places it with the same stage transform (scale and centring) and the hero photo's own intro zoom, copies the photo's opacity and blur during the intro and L0's recede filter on scroll, and fades it out with the wipe into Two Pathways (reduced motion: the same cross-fade window as the layers). It is optional; without it the engine behaves exactly as before. No second scroll controller was added.
- **Delivery.** AVIF and WebP ladders plus one JPEG fallback for each of: hero desktop, hero mobile, bleed desktop and bleed mobile. `sizes` keep encoding the stage's two-axis scale.
- **Resolution limit.** The mockup is 1672 px wide; the student is slightly soft on large Retina screens (see `ASSET-MANIFEST.md`).

## Gradients

- **Colours.** The CSS gradients keep V4's exact stops and directions.
- **Dithering.** A 256 px black/white noise veil at ±1–2/255 sits over the stage at CSS pixel size. It breaks the 8-bit steps of the dark radial and linear gradients without shifting their colour. Measured mean change: under 0.2/255.
- **Photographs.** The hero carries fine luminance grain from the composite and is dithered on quantisation.

## Things the rest of the site should know

- `body:has(.nw4) > header` turns the site header fixed and capsule-shaped on `/` only. Leaving `/` removes the root, so no cleanup is needed and other pages are untouched (verified with client-side navigation away and back).
- The old homepage components (`HomeHero`, `SignatureHero`, `FilmHero`, `ProductEntryCards`, `StudioIntro`, `DiscoveryPillars`, `TrustedStudyExplorer`, `HowItWorks`, `WhyNextwise`, `HomeFinalCTA`) are not deleted. The dev-only `/homepage-preview` routes and their tests still use them.
- `NEXTWISE_HOMEPAGE_HERO` no longer affects `/`.
- No dependency changes. No auth, Supabase, pricing, payment or entitlement code was touched.

## Known differences and open items

- **Header content.** The capsule shows the site's real navigation (Home, Explore Careers, Career Intelligence, Study Abroad, Universities, Courses, search, language, account). V4's prototype labels were Careers, Study Abroad, Student Studio, Guidance, For Parents and "Book a free session". This was an intentional trade-off to keep working navigation. Adding a "Book a free session" button to the header would need a header change and was left out of scope.
- **Hero subject.** The hero comes from the approved mockup. Confirm the rights and model release for the mockup's photograph (its original source) before launch, and replace it with the full-resolution original when available.
- **Hero N.** The mockup's large ribbon N is not reproduced; the N keeps V4's locked animation and rest position.
- **Below the shoulders.** The mockup ends at the glass trust bar, so the scene continues as valley fog rather than an invented body or foreground.
- **Licences.** Credit the photographers where the Pexels licence or your policy asks. See `ASSET-MANIFEST.md`.
- **Destination summaries.** These are V4's orientation text. Have someone review them against each official source and record a "last reviewed" date before launch.
