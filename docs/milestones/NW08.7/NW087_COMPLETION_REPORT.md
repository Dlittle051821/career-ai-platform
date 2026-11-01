# NW08.7 · Signature Motion Experience: completion report

**Status:** three working prototypes delivered in a development-only Motion Lab. The production homepage is unchanged. Nothing has been committed, pushed or deployed.

## Delivered

- `/motion-lab`: comparison gallery
- `/motion-lab/living-path`: A, The Living Path
- `/motion-lab/unfolding-future`: B, The Unfolding Future
- `/motion-lab/window-to-tomorrow`: C, The Window to Tomorrow

Each prototype is scroll-controlled and reversible, tells the four-stage story in order, ends at real entry points, and has a reduced-motion version (OS setting or `?motion=reduced`), a skip link, and a development scrubber (restart, stage jumps, slider). All return 404 in production builds.

## Results

- Typecheck and lint clean. **2,466/2,466 tests pass** (2,405 baseline plus 61 new). Production build passes.
- Browser QA at 375, 390, 768, 1024 and 1440: 0 console errors, 0 horizontal overflow, CLS ≤ 0.0003, no scroll trapping, reversibility confirmed, keyboard clean, reduced motion 12/12.
- **Recommended:** A, The Living Path, ending on working entry points as B does (`NW087_10_RECOMMENDATION.md`).

## Documents

| File | Topic |
|---|---|
| `NW087_01_CONCEPT_OVERVIEW.md` | Concepts and routes |
| `NW087_02_STORYBOARDS.md` | Progress-by-progress storyboards |
| `NW087_03_DESIGN_DECISIONS.md` | Layout, palette, type, brand, iterations |
| `NW087_04_TECHNICAL_ARCHITECTURE.md` | Guard, scroll engine, reduced motion, techniques |
| `NW087_05_FILES_AND_DEPENDENCIES.md` | Files added and modified; dependencies (none new) |
| `NW087_06_PERFORMANCE.md` | CLS and frame timing, with honest caveats |
| `NW087_07_ACCESSIBILITY.md` | Reduced motion, keyboard, screen readers, contrast |
| `NW087_08_BROWSER_TESTING.md` | Evidence index and automated browser checks |
| `NW087_09_QA_REPORT.md` | Gates, tests, constraints checklist, limitations |
| `NW087_10_RECOMMENDATION.md` | Recommended concept and rationale |
| `NW087_INSTALL_GUIDE.md` | How to view locally |
| `evidence/` | Contact sheets, 90+ frames, reduced-motion and gallery captures, six videos, `qa-results.json` |

## Requires your decision

1. Which concept to take forward (recommendation: A).
2. Whether to commit these files on `release/m10` or a separate branch. Nothing has been committed.
3. Real-device review before any homepage work, and written approval before the homepage is changed.

## Notes from the baseline check

- `C:\carrier.ai` contains a stray untracked file named `tatus -sb` (most likely a mistyped `git status -sb`). It is harmless and was left untouched.
- The untracked `supabase/seed/0009_pr01_new_commercial_catalogue_seed.sql` and `supabase/migrations-proposed/*.sql` files are present locally. The existing test suite reads them, which is why 2,405 tests pass locally. They were not modified.
