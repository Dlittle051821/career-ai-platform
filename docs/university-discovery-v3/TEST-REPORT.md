# University Discovery V3 — test report

All tests below ran in the build environment on 17 Nov 2026. **None of them ran against staging or production.**

## Automated checks on the branch

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | clean |
| ESLint | 0 errors, 6 warnings, all in untouched homepage files |
| Vitest | 194 files, 3,438 passed, 1 skipped (production baseline: 190 files, 3,391 passed) |
| UI baseline lock | 238 locked files and 94 tokens match; `npm run verify:baseline` passes |
| Production build | passes |
| Visual regression (`npm run verify:visual`) | **Not a pass.** 3 passed, 18 failed here. The untouched production commit `acf9dff` fails the same 18 in the same environment (2–5 % pixel difference), so the cause is rendering differences between this Linux environment and the machine that produced the baseline, not this branch. It must be run on the owner's PC to count. |

Seven existing source-lock tests described the old public `/universities` page (M20C launch-country strip and old
filter bar). The approved V3 brief replaces that page, so those assertions were rewritten to the V3 equivalents in
`launch-country-discovery.test.ts`, with a comment at each change. No course-page assertion was changed.

## Database authorization — real role boundaries

Environment: disposable local stack — PostgreSQL 16, the Supabase auth server (GoTrue 2.177), PostgREST, all 22
production migrations applied in order, then UNI_V3 0001–0003. Eight real accounts created through the auth API
(free, payment pending, payment failed, Verified by paid invoice, to-be-granted, super_admin, counsellor,
content_editor). 239 Germany records plus one draft loaded. Requests go straight to the REST API with the publishable
key, exactly as an outsider would.

Result: **88 of 88 passed** (`qa/rest-auth-results.json`, script `qa/rest-auth-test.mjs`).

- Before the migration (copy of the database with the original policies): anonymous and free accounts read
  universities and courses directly. The gap is real.
- After: anonymous, free, pending and failed accounts get no rows from universities, campuses, scholarships, courses,
  intakes, fees, admission requirements or university media, including through nested relationship queries.
- Verified (paid) reads the 239 published universities, not the draft, only licence-cleared media, and no course table.
- Staff roles read everything as before.
- Grant function: anonymous 401; free, Verified, counsellor and content_editor 403; a student cannot grant themselves;
  nobody (admin included) can insert a grant row directly; a reason is required; staff accounts cannot be granted.
  After an admin grant the student reads universities and still no courses; students see only their own grant.

## Browser tests by role

Same stack, production build of the branch, Chrome. **127 of 127 passed** (`qa/browser-qa-results.json`).
Anonymous 18, free 22, payment pending 15, payment failed 15, Verified 35, admin grant/revoke 11, admin 6,
expired session 2, network error 2, counsellor 1. Covered: destination choice, portal links through the validated
redirect, every dialog state, price, disabled purchase, focus and Escape, locked profile, no protected record in any
HTML or data response for locked roles, filters, pagination, Back/Forward, save/remove, saved list, Studio panel,
profile sections, grant and revoke with audit log, lock-out after revocation with the shortlist kept, admin course
and university management still loading.

## Responsive

Desktop 1440, tablet 820, mobile 390: 11 pages each across anonymous, free and Verified — no horizontal overflow, no
page errors, dialog fits the viewport (`qa/responsive-results.json`, 33 of 33).

## Not verified

- Anything on Vercel, staging or production; the production Supabase project.
- Visual regression against the locked baseline (see above).
- Core Web Vitals: not measured; a local server on a build machine does not give meaningful field numbers.
- The payment-pending and payment-failed states were produced by seeding invoices, not by a real gateway.
- Real e-mail delivery, real device testing (emulated viewports only), Safari and Firefox.
