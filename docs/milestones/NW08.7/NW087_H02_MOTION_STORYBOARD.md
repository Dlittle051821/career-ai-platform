# NW08.7 · H02 · Motion storyboard

All frames referenced here are **real browser captures** of the implementation (Playwright and Chromium), not mockups. They are in `evidence/homepage/frames/` (`hero-<width>-p<progress>.png`). Contact sheets: `evidence/homepage/hero-contact-sheet-wide.jpg` and `hero-contact-sheet-compact.jpg`. Videos: `evidence/homepage/video/`.

Progress p runs from 0 (hero at the top of the page) to 1 (the pinned stage releases into the next section).

| # | Scene | p | What moves | Frame |
|---|---|---|---|---|
| 1 | **The beginning** | 0–0.10 | On load, the headline lines rise out of their line boxes (CSS, 0.9 s) and the body and actions settle in. A navy point appears near the bottom-left, and a hairline draws from it along the lower edge of the page (time-based, 1.3 s, one-off). Nothing else moves. | `p000` |
| 2 | **The ribbon emerges** | 0.02–0.40 | The ribbon is revealed along its length. Its own width profile grows from a hairline (half-width about 1 unit) through a thick crest into a full sculptural band (about 43 units). It dips into a trough where it turns partly edge-on and darkens, then rises steeply. The camera settles slightly (scale 1.035 → 1). Shadows and the white edge highlight gain strength. | `p015`, `p030` |
| 3 | **The photographic reveal** | 0.27–0.39 | The ribbon crests and loops down the right, turning over to show its underside, and passes behind its own base. A circular edge sweeps the portrait into the loop from bottom-left to top-right, trimmed with a cyan-to-navy ring. The photo then drifts slowly (scale 1.07 → 1, 20 units of vertical parallax, up to p 0.66). | `p042`, `p050` |
| 4 | **The dream expands** | 0.58–0.69, then 0.70–0.85 | The campus sweeps in over the portrait on the same curved edge. The view then pans across the campus, from the gothic tower to the modern skyline, with a slight settle in scale. | `p062`, `p075` |
| 5 | **The path becomes clear** | 0.84–0.93 | Two nodes appear on the starting line, and the Career Intelligence and Study Abroad links rise beside them. On phones they sit in a strip directly under the line. | `p088` |
| 6 | **Into the homepage** | 0.93–1, then release | A fine thread draws down from the starting point to the bottom of the stage. When the stage unpins, a matching thread below the hero turns towards "Choose where to start". | `p100`, `handover-*.png` |

## Reversibility

Every value is a pure function of p (`src/lib/home/signature-hero/timeline.ts`), so scrolling back plays the story backwards exactly. The QA run captured each point going forwards and again going backwards, and compared the pixels (see H10).

## Reduced motion

There is no story and no pin. The final composition is shown at once: ribbon formed, photograph in its loop, pathways visible. See H07.
