# NW08.7 · H09 · Before/after visual comparison

All images are real browser captures (headless Chromium) of this repository running locally:
- **Before:** `/`, the current homepage, unchanged.
- **After:** `/homepage-preview`, the same homepage with the signature hero.

| File | Shows |
|---|---|
| `evidence/homepage/before-after-1440.jpg` | 1440×900: current hero, then the signature hero at first paint, then at p 0.50 (photographic reveal) |
| `evidence/homepage/before-after-390.jpg` | The same at 390×844 |
| `evidence/homepage/before/before-<width>-top.jpg` | The current homepage's first screen at all six test widths |
| `evidence/homepage/hero-contact-sheet-wide.jpg` | Signature hero at 1440, 1280 and 1024 across nine progress points |
| `evidence/homepage/hero-contact-sheet-compact.jpg` | Signature hero at 768, 390 and 375 across nine progress points |
| `evidence/homepage/frames/handover-*.jpg` | The moment the hero hands over to "Choose where to start" |

## What changed, and what didn't

| | Current homepage | With the signature hero |
|---|---|---|
| Headline | "Know What's Next." (sans) | "Turn ambition into *opportunity*." (Fraunces, approved reference) |
| Hero visual | Static: student cut-out over a campus backdrop, with floating annotation cards | Scroll-driven sculptural N-ribbon holding the photography; three beats; pathways at the end |
| Actions | Explore Careers (`/career-discovery`) and Study in Europe (`/study-europe`), plus a career keyword search (GET `/careers?q=`) | Start your journey (`/career-discovery`) and Study in Europe (`/study-europe`). No inline search (see below). |
| Header, navigation, account menu, footer | — | **Unchanged** (the same components from the same layout) |
| Registration prompt | Opens after 45 s of engaged time | Same rules, plus one additive check: the timed prompt waits while the hero story is on screen (H07) |
| Sections below the hero | — | **Unchanged**, same order |

**Decision for you:** the current hero's career keyword search (a real GET form to `/careers?q=`) is not part of the approved reference, so the signature hero leaves it out. Career search is still on `/careers` itself, which is linked from the primary navigation ("Explore Careers"). If you want a search entry in the hero, it can go under the actions without disturbing the composition; this was not done, so as to match the approved reference.
