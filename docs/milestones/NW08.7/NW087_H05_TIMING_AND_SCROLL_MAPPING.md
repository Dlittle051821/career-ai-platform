# NW08.7 · H05 · Animation timing and scroll-progress mapping

## Scroll mechanics

| Item | Value |
|---|---|
| Pinned story length | `250svh` below 1024px, `320svh` from 1024px. Phones get a shorter pin (brief §10: "avoid oversized pinned sections"). |
| Stage | `position: sticky; top: 4rem; height: calc(100svh - 4rem)`. Sits just under the site header's scrolled height (64px). |
| Progress source | `useScroll({ target: section, offset: ["start 64px", "end end"] })` |
| Smoothing | `useSpring` (stiffness 210, damping 38, mass 0.45). Enough to soften wheel steps, little enough to stay attached to the finger. |
| Scroll hijacking | None. No wheel, touch or scroll listeners and no `preventDefault`; a test enforces this. |

## Timeline (`TIMELINE` in `src/lib/home/signature-hero/timeline.ts`)

| Key | Window (p) | Easing | Drives |
|---|---|---|---|
| `restingReveal` | at rest: 0.11 of the ribbon length | ease-out, 1.3 s on load (time-based, once) | The opening hairline |
| `reveal` | 0.02 → 0.40 | easeInOutCubic | Ribbon drawn from 0.11 to 1 of its length (split across the front and back masks) |
| `camera` | 0 → 0.44 | easeInOutCubic | Art scale 1.035 → 1, rise 1.2% |
| `depth` | 0.20 → 0.42 | easeInOutCubic | Ground shadow, the shadow on the photo, edge-highlight strength |
| `portraitIn` | 0.27 → 0.39 | easeInOutCubic | Portrait sweep (curved edge travelling up and to the right) |
| `portraitDrift` | 0.27 → 0.66 | linear | Portrait scale 1.07 → 1, vertical parallax −10 → +10 units |
| `campusIn` | 0.58 → 0.69 | easeInOutCubic | Campus sweep over the portrait |
| `campusPan` | 0.70 → 0.85 | easeInOutCubic | Pan from the gothic tower (image x 0.76) to the city (x 0.52), scale 1.04 → 1 |
| `pathways` | 0.84 → 0.93 | easeOutQuart (arriving) | Nodes scale in; pathway links rise 10px and fade in |
| `continuation` | 0.93 → 1 | easeInOutCubic | Thread from the start point to the bottom of the stage |

The portrait is held fully in view from p 0.39 to 0.58, 0.19 of the story. That is about 0.42 of a viewport of scrolling on desktop (a 320svh pin gives about 2.2 viewports of travel) and about 0.3 on phones. A test requires this hold to be at least 0.12 of the story, so the portrait is held rather than flashed.

## Scenes (`SCENES`)

| Scene | p |
|---|---|
| 1 Beginning | 0–0.10 |
| 2 Ribbon emerges | 0.10–0.30 |
| 3 Photographic reveal | 0.30–0.50 |
| 4 Dream expands | 0.50–0.80 |
| 5 Path becomes clear | 0.80–0.95 |
| 6 Into the homepage | 0.95–1 |

The preview dev bar's buttons 1–6 jump to the middle of each scene; button 6 goes to p = 1.

## Mask mechanics

The ribbon is revealed by two SVG masks, each a white stroke along a centreline sub-path:
- **front:** t 0 → `backFrom`;
- **back:** `backFrom` → 1.

Each mask's `pathLength` is set from `splitReveal(revealAt(p), backFrom)`, so the drawing front passes seamlessly from one layer to the other. Round caps soften the leading edge.
