# CC26-08: Browser and device matrix

All runs were against the CC-26 production build (`next start`) and the local disposable stack. **Only Chromium is installed** in the build environment, and the environment's rules forbid installing other Playwright browsers. Every other engine is therefore recorded as **BLOCKED**, never as PASS.

| Browser / device | Engine | Status | What was covered |
|---|---|---|---|
| Desktop Chrome (1440 × 900) | Chromium 141 (Playwright) | **PASS** | All suites (CC26-06): auth, onboarding, explore, Discovery Session booking, pricing, 40-route sweep (status, overflow, axe, console errors), roles, payments API, V5.4 visual comparison, skip links, reduced motion |
| Tablet portrait (768 × 1024, touch) and landscape (1024 × 768) | Chromium emulation | **PASS (emulated)** | Route sweep, touch-target evaluator |
| iPhone 13 layout (390 × 844, touch, DPR 3) | Chromium emulation of the device profile | **PASS (emulated)**: the layout, touch input and reduced motion were checked; **not Safari** | Route sweep, homepage frames, skip links, tap tests |
| Android Pixel 7 layout (412 × 915, touch) | Chromium emulation | **PASS (emulated)**: the layout and touch input; the same engine family as Android Chrome, but not a real device | Skip links, tap tests, target sizes |
| 320 px narrow phone (touch) | Chromium emulation | **PASS (emulated)** | Onboarding at 320 px, route sweep, target sizes |
| Microsoft Edge | Chromium (not installed as Edge) | **BLOCKED** | Expected to match Chrome (same engine), but not verified |
| Firefox (desktop) | Gecko, not installed | **BLOCKED** | — |
| Safari (macOS) | WebKit, not installed | **BLOCKED** | — |
| iOS Safari (real device) | WebKit | **BLOCKED** | — |
| Android Chrome (real device) | — | **BLOCKED** | — |

## Keyboard, reduced motion, errors and accessibility (Chromium)

- **Keyboard:**
  - visible focus on every interactive element (suite H, focus checks);
  - the mobile menu works by keyboard;
  - the homepage skip links appear on focus at 162.5 × 36 px;
  - the onboarding wizard can be completed with the keyboard alone (suite C).
- **Reduced motion:**
  - the homepage skip links and target sizes were measured with `prefers-reduced-motion: reduce` at 4 viewports;
  - the V5.4 reduced-motion code is unchanged (39/39 protected files byte-identical).
- **Errors:**
  - the outage state on public lists (E10), with a calm error and no crash;
  - genuine 404s for careers, universities, courses and now applications (E9);
  - an expired session explains itself on the next save and asks the user to log in again (H7).
- **axe-core:** checked on 40 routes at 5 widths in the sweep. The only known item is the brand-contrast note carried over from CC-24 (D15, P3), unchanged and out of scope.

## Closing the BLOCKED rows

These need real browsers: Edge, Firefox, Safari on a Mac, an iPhone and an Android phone.

- Once the QA Preview exists (approval A5), run `Verify-CC26-Preview.ps1` (signed-out checks), then the manual journey checklist in CC26-12 §3 on each device.
- Alternatively, approve installing the Playwright Firefox and WebKit engines in a build environment that allows it.
