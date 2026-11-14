# Visual regression calibration (V5.6.3 canonical build)

**Build.** Production build of `893d816` in Linux Chromium (Playwright 1.56.0), with dummy
Supabase variables. The visual pages need no database.

**Method.** Three full runs of `tests/visual/ui-baseline.spec.ts` with zero tolerance
(`VISUAL_CALIBRATE=1`), compared with the committed reference images. Each value is the number
of differing pixels; "0" means the checkpoint was identical in all three runs.

| Checkpoint | Desktop 1440 × 900 (1,296,000 px) | Tablet 768 × 1024 (786,432 px) | Phone 390 × 844 (329,160 px) |
|---|---|---|---|
| home-01 intro N at 1.2 s | 0 | 0 | 0 |
| home-02 hero | 265 / 2,016 / 525 (max 0.16 %) | 54 / 79 / 51 (max 0.01 %) | 3 / 1,032 / 0 (max 0.31 %) |
| home-03 Two Pathways | 287 / 353 / 228 (max 0.03 %) | 147 / 69 / 69 (max 0.02 %) | 80 / 0 / 0 (max 0.02 %) |
| home-04…06 Career Intelligence (3 tabs) | 0 | 555 / 1,185 / 1,021 (max 0.15 %) | 0 |
| page-01 How It Works, page-01b header, page-02 Contact, nav-01 menu | 0 | 0 | 0 |

**Tolerances in the spec.**
- **0.5 % of pixels for the homepage scenes.** That is at least 1.6 × the largest noise
  measured: 1,647 px allowed on the phone against 1,032 px noise.
- **0.1 % for pages, header and menus**, where the noise was 0.
- **No masks.**

**Negative controls.** The tolerances still catch real regressions.

| Build | Result |
|---|---|
| `e37220f`, release candidate, production mode | 21 of 21 (plus the strict header) pass |
| `3f8c59d`, V5.6.2: Master Logo v1, old Career Intelligence scene | **fails** 9 of 21: scene 3 on all viewports, plus the header and page checkpoints. The strict header fails at 1440, 768 and 390. |

**Locked files.** Asset and colour changes too small for a screenshot to notice are caught
byte by byte by `npm run verify:baseline`.
