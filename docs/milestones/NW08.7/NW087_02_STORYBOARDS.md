# NW08.7 · 02 · Storyboards

Progress runs from 0 (the top of the story) to 1 (the end). Every value below comes from the choreography data in `src/lib/motion-lab/*-geometry.ts`, which the tests check. Captions use the shared stage ranges:

| Stage | Progress | Caption |
|---|---|---|
| 1 | 0.00–0.22 | What comes next? |
| 2 | 0.22–0.50 | Your future has possibilities. |
| 3 | 0.50–0.76 | Explore the paths ahead. |
| 4 | 0.76–1.00 | Know What's Next. (with the two CTAs) |

Captions hand over in sequence. The outgoing line fades out completely (over 0.035 of progress) before the incoming line fades in, so two headlines are never on screen together. A test samples 500 points to prove this.

Captured browser frames for every viewport are in `evidence/` (see `NW087_08_BROWSER_TESTING.md`).

## A · The Living Path (`LIVING_PATH_TIMELINE`)

| Progress | What happens |
|---|---|
| 0–0.06 | A single ink point appears near the lower left. |
| 0.04–0.30 | A fine line draws from the point, rising and folding along the trunk curve. |
| 0.24–0.50 | The line thickens into a ribbon: a blue gradient top surface, a darker underside offset for depth, and a soft ground shadow. The ink line hands over to the ribbon (0.30–0.44). |
| 0.50–0.70 | The ribbon branches at the fold. Career Intelligence rises up and to the right and gains an arrowhead (0.63–0.70); Study Abroad runs outward in blue-to-plum. Labelled links appear at both ends (0.62–0.70). |
| 0.78–0.96 | The composition resolves: labels fade, the Study Abroad branch recedes, and the official Nextwise mark fades in at the arrow tip (0.86–0.96). |

Camera: a gentle scale from 1.12 to 0.94 and a 3% rise across the story.

## B · The Unfolding Future (`UNFOLDING_TIMELINE`, `UNFOLD_WINDOWS`)

| Progress | What happens |
|---|---|
| 0–0.22 | A compact zig-zag stack of four panels (alternate panels folded to ±156°) floats small, turned −38°→−24° and tilted 16°. |
| 0.18–0.44 | The object turns to face the viewer. Panel 2 (Career Intelligence) opens in 0.26–0.42. |
| 0.50–0.62 | Panel 3 (Universities and Courses) opens. |
| 0.60–0.74 | Panel 4 (Study Abroad and its six countries) opens. The sheet recentres by half a panel per opened panel and settles to full size. |
| 0.80–0.92 | It becomes the interface: "Where would you like to start?" settles above the sheet (tablet and desktop), and all panel links work. |

Phones: same choreography, but the sheet hangs vertically (rotateX instead of rotateY).

## C · The Window to Tomorrow (`WINDOW_TIMELINE`)

| Progress | What happens |
|---|---|
| 0–0.20 | An arch in a plain canvas wall settles from 90% to full size, filled with soft white-blue light. |
| 0.10–0.32 | The light clears and the campus photograph appears through the window. |
| 0.20–0.50 | The photograph pushes in slowly (scale 1.14→1.04). |
| 0.44–0.62 | Stepping through: the arch scales from 1× to 7× on an accelerating curve and dissolves once it is past the screen edges (0.55–0.62). A canvas scrim fades in behind the captions. |
| 0.50–0.60 | The photograph hands over to an open horizon: a pale sky, a horizon line and a soft blue-to-plum glow. |
| 0.60–0.74 | Six destination beams rise along the horizon, one after another, in registry order. |
| 0.78–0.90 | The scene quietens and a panel of the five product entry points arrives (desktop). On phones the caption CTAs and the "Explore the paths ahead" list below the story serve this role. |
