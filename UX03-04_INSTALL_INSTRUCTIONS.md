# Installing UX03 + UX04 — Design System Consistency & Student Journey Experience

This is the exact, step-by-step install procedure for this upgrade: a set of small, safe design-system
consolidations (UX03) plus a new "Your journey" dashboard component that shows a student where they stand
across six real, honestly-derived stages (UX04). Written for someone applying this update who is not a
developer — follow the steps in order.

It assumes Milestones 1–13 and UX01-02 are already installed and working. Everything below is
**additive or purely presentational**: no database migration, no new environment variable, no new npm
dependency, and no change to any pricing, payment, refund, signature, stamping, or recommendation-scoring
logic.

## 0. Before you start — backup

1. If you are applying this to a working copy of your repository (not a fresh clone), make sure your own
   uncommitted changes are committed or stashed first, so you can tell this update's changes apart from
   your own.
2. This update touches no data — there is nothing in your database to back up specifically because of this
   change — but taking your normal backup before any deploy is still good practice.

## 1. Copy the files

Copy every file listed in `MANIFEST.md` into the matching path in your project, preserving the exact
folder structure. In short:

- Two new files under `src/lib/dashboard/` (plus their two test files).
- One new file under `src/components/sections/dashboard/`.
- One new file under `src/components/ui/` (`FormSuccessNotice.tsx`).
- One new file under `docs/ux/`.
- Five modified files under `src/app/(site)/dashboard/`, `src/components/sections/auth/`,
  `src/components/sections/book-counselling/`, `src/components/sections/career-discovery/`, and
  `src/components/sections/contact/`.
- One modified file at the project root: `vitest.config.mts` (adds one new test-include pattern so the
  two new test files are picked up — nothing existing was removed or changed).

No file under `supabase/`, `src/lib/payments/`, `src/lib/supabase/admin/refunds.ts`,
`src/app/admin/refunds/`, or `src/app/(site)/payments/` should be touched by this update — if your diff
tool shows changes to any of those, stop and re-check before proceeding.

## 2. Install dependencies

From the project root:

```bash
npm install
```

No new npm packages were added for this milestone — this step only ensures your `node_modules` matches
`package-lock.json` after pulling in the new/changed source files above.

## 3. Database migration

**None required.** This update adds no table, column, or policy. Skip straight to Step 4.

## 4. Environment variables

**No new environment variables are required.**

## 5. Run local tests before deploying

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

All four should complete with no errors. `npm test` includes the two new files under
`src/lib/dashboard/` plus every pre-existing test — a failure in any *other* module's test here would mean
something about this update unexpectedly broke earlier functionality, and should be investigated before
deploying. At the time this update was prepared, the full suite passed at 946/946.

## 6. Visual QA, locally

Run the app locally (`npm run dev`) and sign in as a real (or test) student account, then walk through:

1. Visit `/dashboard`. Confirm a new "Your journey" card appears directly below "Your next step," showing
   six stages: Explore, Build Profile, Recommendations, Saved Options, Decide, Apply.
2. Confirm "Your account" and "Your roadmap" now appear further down the page (near Saved/Applications/
   Career Explorer), not immediately below "Your next step."
3. Visit `/login`, `/register`, `/forgot-password`, `/reset-password` — confirm the centered card still
   looks identical to before (this update only changed how it's built internally, not how it looks).
4. Visit `/contact`, `/book-counselling`, and `/career-discovery`, submit each demo form, and confirm the
   "Form preview completed" success message still appears with its original wording.

## 7. Deploy to staging

Deploy the application code as you normally would (the same process you used for prior milestones). There
is no migration to apply first — code-only deploy.

## 8. Responsive QA on staging

Check `/dashboard` at four widths: **375px** (mobile), **768px** (tablet), **1024px** (small desktop), and
**1440px** (desktop):

- [ ] At 375px, "Your journey" shows as a compact vertical list — six rows, each with an icon, a label, and
      a one-line description. No row is cut off, no text wraps awkwardly, no horizontal scrolling appears
      anywhere on the page.
- [ ] At 768px and above, "Your journey" shows as a horizontal row of six connected stages. All six fit
      without scrolling; labels are legible, not truncated or overlapping.
- [ ] At every width, tapping/clicking a stage navigates to that stage's relevant page (e.g. "Build
      Profile" → the profile/onboarding page).

## 9. Manual QA checklist

Walk through each of these on staging with real (or realistic test) accounts in different states:

**Home**
- [ ] Hero layout, CTA hierarchy, and mobile layout are unchanged from before this update (this update
      does not touch the homepage).

**Dashboard — brand-new student (no profile data, nothing saved, no applications)**
- [ ] "Your next step" points at starting the Student Digital Profile.
- [ ] "Your journey" shows Explore as the current stage; every other stage shows as upcoming — none show
      as complete.

**Dashboard — profile in progress**
- [ ] "Your journey" shows Build Profile as the current stage, with the same completion percentage shown
      elsewhere on the page (the Student Digital Profile card).
- [ ] The Build Profile stage's link goes to `/profile/onboarding`, matching "Your next step"'s own link
      for the same situation.

**Dashboard — profile complete, recommendations ready**
- [ ] "Your journey" shows Build Profile and Recommendations as complete, with Recommendations described
      as "ready to view" (never "reviewed" or "completed").
- [ ] "Your next step" and "Your journey" don't contradict each other — both should be pointing toward
      recommendations or whatever comes next, not two different things.

**Dashboard — saved items exist**
- [ ] "Your journey" shows Saved Options as complete, honestly labelled "Saved Options" (not "Shortlist"
      anywhere on the page).
- [ ] The existing "Saved universities & courses" card further down the page still shows the same count.

**Dashboard — application exists**
- [ ] "Your journey" shows Apply as complete, described as "N application(s) in progress" — never
      "submitted" or "accepted" unless that is genuinely what happened.
- [ ] The Decide stage still shows as informational/upcoming even here — it should never show as complete.

**Responsive**
- [ ] 375px / 768px / 1024px / 1440px — see Step 8 above.

**Accessibility**
- [ ] Tab through the dashboard with a keyboard only — every stage in "Your journey" is reachable and
      shows a visible focus ring, and the current stage announces itself (screen reader users: check that
      "aria-current" is present via your browser's accessibility inspector).
- [ ] Confirm no information in "Your journey" is conveyed by colour alone (each state also has a distinct
      icon and text label).
- [ ] Confirm reduced-motion settings are respected (no new persistent animation was added; the only
      animated element on the page — the Button loading spinner — already respected this before this
      update).

**Regression**
- [ ] `/pricing` — view and start a checkout; confirm it behaves exactly as before.
- [ ] An existing agreement/discovery session page — confirm it renders as before.
- [ ] `/admin/refunds` and an existing refund case — confirm the admin refund workflow (Milestone 13) is
      completely unaffected; this update did not touch any refund/payment code.
- [ ] The automated suite (Step 5) already covers this at the code level — this pass is the manual,
      click-through confirmation before a production deploy.

## 10. Rollback

There is no database change to roll back. To revert the *application code*, redeploy the previous release —
nothing in this update depends on new stored data, so the previous code will continue to work correctly
against the same database with no further action needed.
