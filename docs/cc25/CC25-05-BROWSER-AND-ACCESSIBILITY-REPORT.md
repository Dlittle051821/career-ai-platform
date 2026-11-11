# CC25-05: Browser and accessibility report

## 1. Browser coverage (honest)

| Browser | Status | Note |
|---|---|---|
| Chromium (desktop) | **RUN** | Playwright Chromium on the CC-25 production build, local disposable stack |
| Mobile emulation: iPhone 13 (390 px), narrow 320 px | **RUN** | Chromium with touch, mobile viewport and device scale factor. **Not** real Safari |
| Tablet: 768×1024 portrait, 1024×768 landscape | **RUN** | Chromium emulation with touch, in the H1 sweep (CC25-04 has the final result) |
| Desktop Firefox | **NOT RUN** | Only Chromium is installed in the test environment |
| Desktop Edge | **NOT RUN** | Chromium-based, but not tested as Edge |
| Safari/macOS, iOS Safari | **NOT RUN** | Needs Apple hardware. Still a production prerequisite (carried from CC-24) |
| Android browser | **NOT RUN** | Needs a device or emulator |

## 2. Accessibility and responsive results (CC-25 build)

| ID | Check | Status |
|---|---|---|
| H1 (×6) | 26 public routes and 14 signed-in routes at 1440, 390 and 320 px: HTTP status, no horizontal overflow, no serious or critical axe (WCAG 2.1 A/AA) issues, no console errors | **PASS** |
| H2 | Unknown URL → branded 404 with a way home | **PASS** |
| H3 | No broken internal links on signed-in student pages (113 distinct links) | **PASS** |
| H4 | Mobile menu: opens, closes with Escape, focus returns | **PASS** |
| H5 | Visible keyboard focus on 12 consecutive tab stops | **PASS** |
| H6 | **Target size, WCAG 2.2 SC 2.5.8**, 8 student pages at 390 px (protected homepage excluded) | **PASS**: 0 targets fail |
| H6b | Target size on the protected V5.4 homepage (report only) | **FAIL (P2)**: the 6 chapter-rail links ("Go to: …") are 28×1 px and too close together |
| H7 | Expired session: clear message on save, re-login on navigation | **PASS** |
| B1/B2/C1/C16/C17/F1 | Forms: labels, `aria-invalid` with `aria-describedby`, first-error focus, keyboard completion, 320 px fit | **PASS** (B2-mobile: see §4) |
| V1–V3 | V5.4 homepage unchanged | **PASS** (§5) |
| Reduced motion | Homepage frames captured with `prefers-reduced-motion: reduce` are deterministic and identical to `a1017b9` (V3). The CC-22/V5.4 milestones verified the reduced-motion paths. | **PASS** |
| Loading states | Course and university lists stream their own skeleton (CC-24). Wizard save shows a busy state (C15) | **PASS** |

## 3. Touch targets: CC-24 H6 re-measured

CC-24's H6 counted every control under 24×24 px, so it also flagged targets that WCAG 2.5.8 explicitly exempts:
- inline links inside sentences;
- targets that keep a 24 px spacing circle clear of other targets.

CC-25 measures 2.5.8 itself (`qa/target-size.cjs`):
- size, or the spacing exception, or the inline exception;
- a target scrolled out of view inside a scroll container is measured where it can actually be used.

| Page group | CC-24 naive count | CC-25 (2.5.8) |
|---|---|---|
| /register, /login, /forgot-password, /pricing, /careers, /study-options, /book-counselling | Several (inline "Terms", "Privacy Policy", "Forgot password?", "View all services") | **0 failures** (inline or spacing exceptions apply) |
| /courses, /universities filter checkboxes (16×16) | Flagged | **0 failures**: rows are 20 px tall, so centres sit 26 px apart (spacing exception). The same result on the unmodified `a1017b9` build. **No code change was needed**; an initially added row-height tweak was reverted. |
| /dashboard, /profile, /onboarding (signed in) | — | **0 failures** |
| Homepage (protected V5.4) | Flagged | **6 failures**: the chapter-rail links, 28×1 px |

**The homepage rail is a protected V5.4 file.** Fixing it means changing the rail's hit area in `v54.css` (for example an invisible 24 px tall hit box around each 1 px line, with no visual change). Under the CC-25 rules that needs design sign-off and visual-regression evidence, so it was **not changed**. The proposed fix is recorded for the next homepage update.

## 4. Test reliability note

- **B2-mobile** failed once in the first CC-25 run ("focus on" empty). Five repeat runs showed focus *does* land on the name field. In one of the five, the test read the focus before the browser moved it.
- The check now waits up to 2 s for focus. The assertion is unchanged.
- The final run result is in CC25-04.

## 5. V5.4 homepage protection

- **39 protected files:** hash-identical to `a1017b9` (checked by `Finish-CC25.ps1` and the CC-24 Vitest guard).
- **DOM and links:**
  - The rendered DOM is identical to the deployed `a1017b9` build: 73,702 characters on desktop and 73,598 on mobile.
  - All 28 internal links are identical.
- **Scroll frames:** 16 of 16 match at 8 positions per viewport with motion paused. The only difference is 4 px of anti-aliasing noise in one frame (max delta 1/255).
- **Console:** 0 errors.
- **Animation:** the N animation, the automatic hero, the Career Intelligence and Study Abroad chapters, and the scroll transitions are untouched (no protected file changed).

## 6. Portrait licensing: BLOCKER, unresolved

**Finding.** `docs/home-v5-4/PORTRAIT-ASSET.md` records that `public/home-v54/v54-portrait.png` was *extracted from the approved V5 reference image*. That image "appears to depict the same person as the model in the Mindly reference". No licence, model release or commercial-use permission is documented anywhere in the repository, the milestone folders or the project notes. The PNG carries no licence metadata. **Documented commercial-use rights: none found.**

**Why free sources are not a drop-in answer.**
- Pexels and Unsplash licences allow commercial use of the photograph. They do **not** guarantee a model release for identifiable people.
- Unsplash's own help centre says it "cannot make any guarantees" and advises contacting the contributor about releases.
- Portraits of identifiable people used in advertising also raise right-of-publicity questions.
- An earlier Nextwise note (V4, 4 Nov) already flagged that the Pexels candidates had no model release.

**Acceptable replacement (any one):**
1. **Commissioned shoot.** Indian student, blue-hour light, upward gaze, subject centre-right, framed for `v54-portrait.png` (1860×1174, transparent). You need a signed **model release** covering commercial web and advertising use, and a photographer assignment or licence.
2. **Commercial stock licence.** The licence page must show **"model released: yes"** for that exact asset (Adobe Stock, Shutterstock or Getty, for example), with a licence covering web and marketing use. Keep the licence certificate and the asset ID.
3. **Written rights for the current image.** Written confirmation from the photographer *and* the model (or the "Mindly" rights holder) that Nextwise may use this likeness commercially.

**Evidence to file before launch:** the licence or certificate PDF, the asset ID or shoot contract, the model release, and the date. Add them to `docs/home-v5-4/PORTRAIT-ASSET.md`.

**CC-25 action:** none on the image, per the brief (no silent design change). **Release blocker for production.** It doesn't block staging.

Sources consulted:
- [Unsplash Help: Releases and trademarks](https://help.unsplash.com/en/articles/2612329-releases-and-trademark)
- [Unsplash+ License](https://unsplash.com/plus/license)
