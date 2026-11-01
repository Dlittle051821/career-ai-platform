# NW08.5.7 — Smart Student Registration Prompt

## 1. Architecture

One component, mounted once: `<RegistrationPrompt />` in
`src/app/(site)/layout.tsx`, alongside `Header`/`Footer`. It is present on
every public page via the shared layout, not copy-pasted per page, and
renders nothing (a closed `<dialog>`) until it decides to open.

```
src/lib/registration-prompt/
  eligibility.ts   — pure: ENGAGED_THRESHOLD_MS, SUPPRESSION_DURATION_MS,
                     EXCLUDED_PATH_PREFIXES, isPathEligibleForPrompt,
                     isSuppressedByPriorDismissal, computeDismissUntil,
                     canShowRegistrationPrompt (unit tested)
  storage.ts       — thin: real localStorage/sessionStorage reads/writes
                     (reviewed structurally, same convention as every
                     Supabase "thin wrapper" in this codebase)
  event-bus.ts     — the contextual-trigger dispatcher/listener wiring
src/components/registration-prompt/
  RegistrationPrompt.tsx — the dialog, the timer, the render
```

## 2. Timing model

A single `setInterval` (1s tick), started once the visitor's auth state
is known, accumulates engaged time in a ref — incremented only while
`document.visibilityState === "visible"` AND the current route passes
`isPathEligibleForPrompt`. A backgrounded tab, or time spent on an
excluded page, never counts. Because the component lives in the shared
`(site)` layout rather than being remounted per route, this interval
survives client-side navigation between public pages automatically — the
brief's "not retriggered on navigation" requirement falls out of where
the component is mounted, not a special case inside it. At 45 accumulated
seconds, it calls the one shared gate, `canShowRegistrationPrompt()`, and
opens if that gate passes.

A contextual path exists in parallel: anything can call
`requestRegistrationPrompt(reason)` (re-exported from
`RegistrationPrompt.tsx` for discoverability) to request an immediate
open, subject to the exact same gate. See §4 for what is and isn't wired
to it yet.

## 3. Eligibility gate (`canShowRegistrationPrompt`)

All four conditions must hold, every time (timer or contextual):

1. `!isAuthenticated` — read from `useAuthUser()`, the same hook
   `MobileNav.tsx` already uses; never shown to a signed-in visitor.
2. `isPathEligibleForPrompt(pathname)` — `false` on login/register/
   forgot-password/reset-password/auth/welcome/dashboard/profile/saved/
   applications/payments/agreements/pricing-checkout/discovery-session/
   recommendations/roadmap/pay/admin/studio/counsellor/go/api and
   anything nested under them. `/pricing` itself stays eligible; only
   `/pricing/checkout/**` is excluded.
3. `!hasShownThisVisit()` — a `sessionStorage` flag, so it never repeats
   within one browser-tab visit, but a new tab/session can see it again.
4. `!isSuppressedByPriorDismissal(now, dismissedUntilMs)` — a
   `localStorage` timestamp set on dismissal, 7 days in the future
   (`computeDismissUntil`).

## 4. Contextual triggers — what's wired, what isn't

`event-bus.ts` and the listener in `RegistrationPrompt.tsx` are real,
working, tested infrastructure: any code can call
`requestRegistrationPrompt("some-reason")` right now and the prompt will
open (subject to the gate above) with no further plumbing.

**Not retrofitted this milestone:** the one existing anonymous "save"
affordance already in the codebase, `SaveUniversityButton.tsx`'s
logged-out state, is left exactly as it was — a direct, honest "Log in to
save" link straight to `/login?next=...`. That is already a correct,
pre-existing, tested, zero-friction anonymous-save UX; inserting an
interrupting modal in front of an already-working, direct link would be
a regression, and this milestone's own instruction for the authenticated/
existing-surface audit ("low-risk only, do not rebuild working flows")
counsels the same restraint here. A future pass that wants the
"contextual, not timed" experience the brief prefers can change that one
link to call `requestRegistrationPrompt("save-university")` instead of
navigating straight to `/login` — one line, no new infrastructure needed.
The same applies to any future anonymous "save career" / "shortlist" /
"save comparison" control that gets built: call the one exported function,
nothing else to wire.

## 5. Copy (verbatim, matches the brief)

- Headline: "Explore Freely. Save Your Future."
- Description: "Create your free Nextwise account to save careers,
  shortlist universities and continue your journey."
- Primary CTA: "Create Free Student Account" → `/register?next=<current path>`
- Secondary CTA: "Sign In" → `/login?next=<current path>`
- Dismiss: "Continue Exploring"
- A short three-item benefit list (save careers / shortlist universities
  / continue your journey) under the description, matching the mockup's
  "brief benefit list" instruction.

## 6. Accessibility

Built on the native `<dialog>` element via `showModal()`/`close()` — the
same reviewed pattern `MobileNav.tsx`'s drawer already uses in this
codebase, not a hand-rolled modal:

- Focus trap and `::backdrop` dimming come from the browser's own native
  dialog implementation, not custom JS.
- `aria-labelledby`/`aria-describedby` point at the real headline/
  description element ids.
- Escape closes it natively (`<dialog>`'s own "cancel" → "close" event);
  the component's `close` listener keeps React state in sync either way
  dismissal happens (Escape, backdrop-independent explicit close, or the
  "Continue Exploring" button).
- Focus restoration to whatever had focus before the dialog opened is the
  native `<dialog>` behavior per the HTML spec — not reimplemented here.
- The close "×" button is `autoFocus`ed on open (a deterministic, visible,
  `aria-label="Close"` target) and the two other dismiss paths ("Continue
  Exploring" and clicking a CTA) are plain, labelled, keyboard-reachable
  controls.
- Entrance animation reuses the project's existing `FADE_UP_CLASSES`
  (`src/lib/ui/motion.ts`), which already carries its own
  `motion-reduce:` override — no new, unreviewed animation.
- Mobile: the dialog is a centered, viewport-clamped card
  (`w-[min(92vw,30rem)]`), not an edge-to-edge full-screen takeover, so it
  never overlaps a mobile OS's own system gesture areas or this site's
  mobile nav.

## 7. Persistence / privacy

Two browser-storage keys, no PII, no new backend table, no server round
trip:

| Key | Storage | Value | Lifetime |
|---|---|---|---|
| `nw_registration_prompt_dismissed_until` | `localStorage` | a future timestamp (ms) | until it naturally elapses (~7 days) or the visitor clears site data |
| `nw_registration_prompt_shown_this_visit` | `sessionStorage` | `"1"` | until the tab/browser closes |

Both reads/writes are wrapped in `try`/`catch` (`storage.ts`) so a
private-browsing storage denial degrades to "show it anyway" rather than
throwing.

## 8. Test matrix — status

| Scenario | How it's covered |
|---|---|
| Anonymous, eligible page, 45s elapsed | `canShowRegistrationPrompt` unit test ("allows showing when every condition is met") |
| Authenticated visitor | unit test ("never shows to an authenticated user") |
| Fresh visit (no prior storage) | `isSuppressedByPriorDismissal(now, null)` unit test |
| Dismissed visit, same session | `alreadyShownThisVisit` unit test |
| Cross-page navigation within one visit | architectural: the component/interval lives in the shared layout, not remounted per route — documented in §2, not independently re-provable by a source-text test |
| 7-day suppression, and its expiry | `isSuppressedByPriorDismissal`/`computeDismissUntil` unit tests (both "still suppressed" and "no longer suppressed" boundaries) |
| Login/register/password-reset exclusion | `isPathEligibleForPrompt` unit test |
| Checkout exclusion (pricing page itself stays eligible) | `isPathEligibleForPrompt` unit test, explicit `/pricing` vs. `/pricing/checkout/**` case |
| Background-tab timing (must not count hidden time) | source-audit test confirms the `document.visibilityState !== "visible"` guard exists in the interval callback; the actual 1-second-tick accrual itself is DOM-timer orchestration, not exercised by this project's no-jsdom test setup — see §9 |
| Keyboard close (Escape) | relies on the native `<dialog>` element's own Escape handling, the same mechanism already shipped and (implicitly) reviewed via `MobileNav.tsx`; not independently unit-testable without a renderer |
| Mobile layout | `w-[min(92vw,30rem)]` viewport-clamped sizing, source-reviewed; **not** pixel-verified live — see §9 |

## 9. Disclosed testing limitation

Same pre-existing, disclosed sandbox constraint as every other milestone
in this session: no React Testing Library/jsdom exists in this project
(confirmed again via `package.json`/`vitest.config.mts` — the project
has never added a DOM-rendering test stack, by established convention),
and this sandbox has no live browser to drive manually either. Every
scenario above that depends on actual DOM timers, focus order, or
rendered layout is covered as far as static source-text inspection can
reach (the right functions are called, the right classes/attributes are
present, the right guard conditions exist in the code) but not by an
executed, rendered test. **Manual verification steps for a real browser,
once one is reachable:** (1) load any eligible public page signed out,
wait 45s with the tab focused, confirm the dialog opens with focus on the
"×" button; (2) switch to another tab for 10s mid-countdown, switch back,
confirm the remaining wait is still ~45s total engaged time, not 45s
wall-clock; (3) dismiss via "Continue Exploring", reload, confirm it does
not reappear this session; (4) clear `sessionStorage` only (simulating a
new tab) and confirm it can reappear, but clear nothing and wait >45s
again on the same tab and confirm it does not repeat; (5) manually set
`localStorage.nw_registration_prompt_dismissed_until` to a past timestamp
and confirm it can reappear; (6) visit `/login` directly and wait 60s,
confirm it never appears there; (7) press Escape while open, confirm it
closes and focus returns to the element that had focus beforehand; (8) at
375px width, confirm the dialog neither overflows the viewport nor
overlaps the bottom mobile nav/system gesture bar.
