# NW08.7 · H01 · Signature motion homepage: creative and technical specification

This part of NW08.7 implements the **approved homepage direction**, "Turn ambition into *opportunity*." with a sculptural, scroll-driven N-ribbon. It is built as real Next.js components and is integrated into the homepage behind a switch that is **off by default**.

The earlier Motion Lab prototypes (`NW087_01`–`NW087_10`) are unchanged and remain development-only.

## What the visitor sees

A warm-white editorial hero. The headline is on the left: "Turn ambition into" in Fraunces upright, and "*opportunity.*" in Fraunces italic. Under it are a one-line promise and two actions. A delicate blue line starts at a single point near the bottom of the page.

As the visitor scrolls, the line thickens into a sculptural ribbon. It crests, dips, turns and rises steeply up and to the right, the gesture of the Nextwise N-arrow. It then loops over and down, turning to show its navy underside, and passes behind itself.

The loop it makes is a window. A photograph sweeps into it on a curved, ribbon-coloured edge: first an aspirational portrait, then a European campus. The view then pans across the campus to the city beyond. Finally, the two Nextwise pathways (Career Intelligence and Study Abroad) appear as real links on the line where the journey began. A fine thread carries that line down into "Choose where to start", the existing next section.

## Creative decisions

| Decision | Why |
|---|---|
| The ribbon is one continuous object from first frame to last | Brief §07 asks for continuity: no hard cuts and no disconnected phases. Every scene is a state of the same ribbon. |
| The photograph is inside the ribbon, not behind it | The loop's back half is drawn behind the photo and its front half (the rise and crest) in front, in one SVG. The image is clipped to the loop, so the ribbon visibly holds the photograph (brief §07, scene 3). |
| Scene transitions are curved sweeps, not crossfades | A circular edge travels up and to the right (the ribbon's own direction), trimmed with a cyan-to-navy ring. The incoming photo stays still while the edge passes, which is the "masking and spatial movement" brief §07 scene 4 asks for. |
| Three beats from two photographs | Portrait (ambition), then campus (educational opportunity), then a pan across the same campus to the modern city (international possibility). This avoids a third download and uses only approved assets (see H04). |
| The pathways live on the starting line | "The path becomes clear" is literal: nodes appear on the line the story began with, labelled with the two real products. |
| The headline and actions never move during the story | The storyboard's "final hero state: same headline and CTA". Visitors can act at any moment; nothing is hidden behind the animation. |

## Colour (brief §04)

The canvas is `#FAFAF8`, headings `#101827`, body `#566174`, the primary action `#1454D9` (hover `#1759F3`), and the focus ring `#1454D9`.

The ribbon follows the official N-arrow. Logo pixels were sampled from `public/brand/nextwise-icon.png`, giving cyan through cobalt (about `#0048F0`) to navy (about `#001860`). The ribbon surface runs `#32D5E8` → `#22B8F0` → `#1759F3` → `#1454D9` → `#0E2F86` along its length, and the underside uses `#071D4A`–`#123A9C`. There is no purple, no neon, no glow and no glassmorphism.

## Typography (brief §05)

- **Headline:** Fraunces (SIL OFL, already the site's display face), weight 450, optical size 144. The italic is loaded only by this hero, through `next/font` in `signature/fonts.ts`, so no other page downloads it.
- **Size:** `clamp(2.45rem, 9.6vw, 3.7rem)` on phones and `clamp(3.3rem, 5.4vw, 5.9rem)` from 1024px up.
- **Everything else:** the site's existing Plus Jakarta Sans.

## Navigation and functionality (brief §11–12)

The existing `Header`, `MobileNav`, account menu, `Footer` and `RegistrationPrompt` are untouched and still render from the `(site)` layout. All six primary navigation items are unchanged, and the hero adds no navigation of its own.

| Link | Route |
|---|---|
| Start your journey | `/career-discovery` (the current hero's primary destination) |
| Study in Europe | `/study-europe` (the current hero's secondary destination) |
| Career Intelligence pathway | `/career` |
| Study Abroad pathway | `/abroad` |

Every one of these is an existing public route, and a test checks that each route file exists.

No backend, schema, authentication, pricing, payment, entitlement or data file is touched.

## How it ships (brief §13)

| Phase | Done |
|---|---|
| A · Audit and backup | Repository verified at `e014164`. Affected files are listed in H03. The original homepage source is unchanged and stays the default (see H12). Baseline screenshots are in `evidence/homepage/before/`. |
| B · New experience | `src/components/sections/home/signature/` (six files) and `src/lib/home/signature-hero/` (five modules and tests) |
| C · Local preview | `/homepage-preview`: the full homepage with the new hero, plus a preview-only inspection bar. Development and test only; 404 everywhere else. |
| D · Integration | `src/app/(site)/page.tsx` renders `SignatureHero` only when the server-side variable `NEXTWISE_HOMEPAGE_HERO=signature` is set at build time. Unset, which is the default everywhere today, `/` is exactly the current homepage. |

Nothing has been committed, pushed or deployed.
