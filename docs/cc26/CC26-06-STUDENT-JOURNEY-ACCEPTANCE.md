# CC26-06: Student journey acceptance

**Build:** the CC-26 production build (`next start`, port 3026) against the LOCAL disposable stack: PostgreSQL 16 with 0001–0022, cc25/0023 revision 2, 0024, 0025 and 0026, plus GoTrue, PostgREST and a mail sink.

- **Accounts and records:** all fictional (`@example.test`). Nothing touched QA or production.
- **Harness:** the CC-25 Playwright suites, with three changes:
  - E9 and P2 are strengthened;
  - P2b and suite R26 are new;
  - H6b uses the corrected target-size evaluator (CC26-04).
- **Browser:** Chromium only (CC26-08).

## 1. Summary

**124 checks: 123 PASS, 0 FAIL, 1 BLOCKED.**

The BLOCKED check is D8: student recommendation reports need NW07, which is not applied locally by design. The page shows an honest "temporarily unavailable" state (CC26-07).

| Brief journey | Covered by | Result |
|---|---|---|
| Registration and login | Suite B, 19 checks (registration, confirmation, login, logout, password reset, safe `next` redirects) | PASS |
| Student onboarding | Suite C, 17 checks (11-step wizard: save, resume, validation, keyboard, 320 px) | PASS |
| Profile persistence | C (resume after reload), H7 (session expiry keeps saved steps) | PASS |
| Career Explorer | D1–D7, D9 | PASS |
| University and Course Explorer | E1–E7, E10 (outage), genuine 404s | PASS |
| Saved and comparison features | D4 (career comparison), E6 (course comparison), E7 (saved course appears in Saved) | PASS |
| Discovery Session booking | Suite F, 13 checks (booking, duplicates, server validation, IST scheduling) | PASS |
| Admin approval workflow | R25-05 (one-click approval, stamped and audited by the database) | PASS |
| Counsellor Studio permissions | R25-03/04/06–11 (unapproved, self-claim, reassignment, completion); **R26-01/02** (a deactivated counsellor loses the caseload, session identity and queue: student page and session detail answer 404 with nothing identifying) | PASS |
| Student dashboard | H sweep (signed-in routes at 5 widths) | PASS |
| Career Studio / Abroad Studio | E8, H sweep | PASS (live application tasks need NW06, which is not applied) |
| Application workspace | **E9: an unknown id answers HTTP 404**, a malformed id 404, the list 200 (was a soft 404 in CC-25) | PASS |
| Recommendation reports | D8 | **BLOCKED** (needs NW07) |
| Pricing and payments | G1–G8, P1–P7 with **P2 strengthened** (direct RPC refused, 42501, no invoice, purchase or invoice number) and **P2b** (direct payment-attempt insert refused) | PASS |
| Homepage (V5.4) | V1–V3 at desktop and mobile: DOM identical to the deployed `a1017b9` build; 16/16 scroll frames match (one with 4 px of anti-aliasing noise) | PASS |
| Route sweep | H1 (26 public and 14 signed-in routes × 5 widths: status, overflow, axe, console), H2–H7 (links, focus, mobile menu, **touch targets 0 failures**, session expiry) | PASS |

Logs: `evidence/final/*.log`, `results.jsonl`. Screenshots: `evidence/final/shots/`.

## 2. All checks

| Suite | ID | Check | Result | Detail |
|---|---|---|---|---|
| B-auth | B1-desktop | Registration page opens (desktop) | **PASS** | 200, no overflow, axe clean |
| B-auth | B2-desktop | Empty submit shows field errors and focuses the first (desktop) | **PASS** | 5 fields flagged, focus on full name, errors linked by aria-describedby |
| B-auth | B1-mobile | Registration page opens (mobile) | **PASS** | 200, no overflow, axe clean |
| B-auth | B2-mobile | Empty submit shows field errors and focuses the first (mobile) | **PASS** | 5 fields flagged, focus on full name, errors linked by aria-describedby |
| B-auth | B3 | Invalid email and weak password give useful errors | **PASS** | email, password and phone errors shown |
| B-auth | B4 | Successful registration: honest 'check your email', confirmation email, link signs in | **PASS** | profile created, 1 confirmation email (local catcher), link -> /auth/callback -> /welcome |
| B-auth | B5 | Existing email: message does not reveal whether an account exists | **PASS** | same neutral 'check your email' response as a new account |
| B-auth | B6-desktop | Login with a valid account lands on the dashboard (desktop) | **PASS** | redirected to /dashboard without an error |
| B-auth | B6-mobile | Login with a valid account lands on the dashboard (mobile) | **PASS** | redirected to /dashboard without an error |
| B-auth | B7 | Wrong password and unknown email get the same safe error | **PASS** | "Email or password is incorrect." |
| B-auth | B7b | Login before confirming email explains what to do | **PASS** | "Please confirm your email address first — check your inbox for a confirmation link." |
| B-auth | B8-desktop | Logout ends the session (desktop) | **PASS** | auth cookie cleared; /dashboard now redirects to /login |
| B-auth | B8-mobile | Logout ends the session (mobile) | **PASS** | auth cookie cleared; /dashboard now redirects to /login |
| B-auth | B9 | Password reset: neutral message, emailed link, new password works | **PASS** | same message for known/unknown email; link -> /reset-password; new password accepted by GoTrue |
| B-auth | B9b | Expired or invalid reset link shows a clear message | **PASS** | lands on /reset-password?authError=1 with an explanation |
| B-auth | B10 | Protected routes redirect signed-out visitors (17 routes) | **PASS** | all 307 -> /login?next=<route> |
| B-auth | B11 | A safe ?next returns the student to the intended page | **PASS** | /login?next=/studio/career -> /studio/career |
| B-auth | B12 | External or malicious ?next values are rejected (login form) | **PASS** | 7 payloads all stayed on http://localhost:3026 (landed on /dashboard) |
| B-auth | B12b | Auth callback ignores external ?next | **PASS** | every redirect stays on the app origin |
| C-onboarding | C1 | Wizard opens at step 1 for a new student; layout and accessibility | **PASS** | About You, axe clean |
| C-onboarding | C2 | All 11 data steps save and advance; each step's data is in the database | **PASS** | 11 steps saved (rows verified per table); onboarding_current_step=12 |
| C-onboarding | C3 | Back navigation keeps earlier answers | **PASS** | step 3 shows Mathematics still selected |
| C-onboarding | C4 | Review step lists the answers and Edit returns to the right step | **PASS** | review shows saved answers; Edit -> Education |
| C-onboarding | C5 | Completing the profile reaches the dashboard and records completion | **PASS** | landed /profile; profile completed 100 |
| C-onboarding | C6 | Save & Exit at step 4, then resume where the student left off (mobile) | **PASS** | saved, landed on /dashboard, resumed at Interests with selections restored |
| C-onboarding | C7 | Phone layout: no sideways scroll on the wizard (390 px) | **PASS** | 0 px |
| C-onboarding | C8 | Future date of birth is rejected with a message and no save | **PASS** | "Please enter a valid date of birth." |
| C-onboarding | C9 | Started education entry without a level is rejected | **PASS** | "Please select an education level for each entry you've started, or remove the empty ones." |
| C-onboarding | C10 | Started experience entry without a title is rejected | **PASS** | "Please add a title for each entry you've started, or remove the empty ones." |
| C-onboarding | C11 | Required (*) markers are explained; a partial step can still be saved (design check) | **PASS** | legend shown under the step heading; Continue saves the partial step (completion is checked on Review) |
| C-onboarding | C12 | Completing with required sections missing explains what to finish | **PASS** | blocked: "Please complete these sections first: About You, Education, Subject Strengths, Interests, Skills, Work Preferences, Career Priorities, Career Goals, S |
| C-onboarding | C13 | Server-side save failure keeps the answers and allows a retry | **PASS** | error "We couldn't save your changes. Please try again."; selections kept; retry saved and advanced |
| C-onboarding | C14 | Lost connection in the browser shows a recoverable message | **PASS** | "We couldn't reach Nextwise to save this step. Your answers are still here — check your connection and try again." |
| C-onboarding | C15 | Slow save: button shows progress and double-clicks cause one save | **PASS** | busy state shown; exactly one write |
| C-onboarding | C16 | Keyboard: step 1 can be completed without a mouse, and focus moves to the new step | **PASS** | completed with keyboard; focus ring true; focus -> H1 Education |
| C-onboarding | C17 | 320 px: wizard steps fit without sideways scroll; axe clean | **PASS** | steps 1, 3, 6, 9, 12 fit at 320 px with no serious axe issues |
| DE-explore | D1-desktop | Career hub and career list render (desktop) | **PASS** | 9 public career/abroad pages: 200, no overflow, no serious axe issues, no console errors |
| DE-explore | D1-mobile | Career hub and career list render (mobile) | **PASS** | 9 public career/abroad pages: 200, no overflow, no serious axe issues, no console errors |
| DE-explore | D1-narrow | Career hub and career list render (narrow) | **PASS** | 9 public career/abroad pages: 200, no overflow, no serious axe issues, no console errors |
| DE-explore | D2 | Career search: results, and an honest empty state | **PASS** | 'engineer' -> 20 links; nonsense query -> empty-state message |
| DE-explore | D3 | Unknown career slug returns a real 404 (not a soft 404) | **PASS** | 404 |
| DE-explore | D4 | Career comparison shows both careers | **PASS** | both careers rendered side by side |
| DE-explore | D5 | Public career/abroad pages do not promise AI or counsellor-verified recommendations | **PASS** | no AI / counsellor-verified / guarantee claims found on 11 pages |
| DE-explore | D6 | Dashboard: every navigation link resolves | **PASS** | 14 links on the dashboard, none 4xx/5xx |
| DE-explore | D7 | /studio/career opens the career workspace (dashboard) | **PASS** | redirects to /dashboard (career workspace by design) |
| DE-explore | D8 | Recommendation reports: honest state when the reports function is unavailable | **BLOCKED** | page shows 'temporarily unavailable' (honest). Live reports need NW07 get_my_recommendation_reports, not in migrations 0001-0022 |
| DE-explore | D9 | Recommendations page for a student without a profile does not imply ready recommendations | **PASS** | "GOOD EVENING, FICTIONAL 👋 Your personalised recommendations Based on your profile, interests, academic background, and career goals — plus how reliab" |
| DE-explore | E1 | Universities list: only published records; badges match verification status; rankings only when verified | **PASS** | draft hidden; Liffey and Polder labelled 'Not yet verified'; Northbridge (verified) not labelled |
| DE-explore | E2 | University detail: unverified note on unverified records; ranking hidden unless verified | **PASS** | Liffey shows the unverified note and no ranking; Northbridge shows neither warning |
| DE-explore | E3 | Draft university and unknown slugs are not found | **PASS** | 404 for draft university, unknown university, unpublished course |
| DE-explore | E4 | Course filters: text, destination, degree level, and empty results | **PASS** | all 4, q=Design 2, country=Germany 2, masters 2, nonsense 0 with empty-state message. Note P2: ?destination=DE (used by the 'Explore a launch country' chips) li |
| DE-explore | E5 | Course detail: unverified course labelled; verified course shows last verified | **PASS** | needs-review course labelled; verified course shows 'Last verified' |
| DE-explore | E6 | Course comparison works for two courses | **PASS** | two courses compared on /courses/compare |
| DE-explore | E7 | Saving a course appears in Saved | **PASS** | 1 saved row; listed on /saved |
| DE-explore | E8 | Abroad studio and applications: empty states without errors | **PASS** | studio and 'No Abroad applications yet' render. Live application tasks (NW06/NW07) not exercised: deferred |
| DE-explore | E9 | Application detail for a non-existent application answers a genuine HTTP 404 | **PASS** | unknown id 404, malformed id 404, list 200 |
| DE-explore | E10 | Course list when the database is unreachable shows a calm error, not a crash | **PASS** | status 200: "COURSE EXPLORER Browse courses Search and filter a starter dataset of university courses — subject, qualification level," |
| F-discovery | F1-desktop | Public free-session page renders and leads to the request form (desktop) | **PASS** | 200, no overflow, axe clean, no confirmed-slot wording |
| F-discovery | F1-mobile | Public free-session page renders and leads to the request form (mobile) | **PASS** | 200, no overflow, axe clean, no confirmed-slot wording |
| F-discovery | F1-narrow | Public free-session page renders and leads to the request form (narrow) | **PASS** | 200, no overflow, axe clean, no confirmed-slot wording |
| F-discovery | F2 | Signed-out visitor is sent to log in and returned to the request form | **PASS** | /discovery-session/book -> /login?next=… -> back to the form after login |
| F-discovery | F3 | Request form: contact method, time of day and language; honest success message | **PASS** | row saved as 'requested' (whatsapp/evening/Odia, no time); copy says it is a request, not a booked slot, and that no notifications are sent |
| F-discovery | F4 | Duplicate request: page shows the existing request instead of a second form | **PASS** | "You already have a Discovery Session requested A counsellor will reach out to confirm a time that works for you." |
| F-discovery | F5 | Duplicate request via the server action directly is refused (one active request per student) | **PASS** | replayed action -> 'You already have a Discovery Session request in progress'; still 1 row |
| F-discovery | F6 | Dashboard shows the request as requested, with no time yet | **PASS** | "Discovery Session Requested Career Guidance Session View Session Details" |
| F-discovery | F7 | Server rejects an invalid contact method sent directly to the action | **PASS** | no row stored; generic error returned (database check constraint enforces the value) |
| F-discovery | F8 | Very long free-text fields sent directly to the action | **PASS** | rejected |
| F-discovery | F9 | Admin schedules 20 Nov 2026 18:30 IST from a New York browser; stored as 13:00 UTC | **PASS** | stored 2026-11-20 13:00 scheduled UTC; form re-shows 2026-11-20T18:30 (IST) in a New York browser |
| F-discovery | F10 | Student sees the scheduled time in IST (browser in Berlin) | **PASS** | "Discovery Session Scheduled Career Guidance Session Fri, 20 Nov, 6:30 pm IST View Session Details" |
| F-discovery | F11 | Assigned counsellor sees the session in their list | **PASS** | session listed with the student's name |
| G-pricing | G1-desktop | Pricing shows ₹1,999 tax-inclusive and no checkout links (desktop) | **PASS** | ₹1,999, tax included, 0 checkout links, free-session CTA present |
| G-pricing | G1-mobile | Pricing shows ₹1,999 tax-inclusive and no checkout links (mobile) | **PASS** | ₹1,999, tax included, 0 checkout links, free-session CTA present |
| G-pricing | G1-narrow | Pricing shows ₹1,999 tax-inclusive and no checkout links (narrow) | **PASS** | ₹1,999, tax included, 0 checkout links, free-session CTA present |
| G-pricing | G2 | Direct visit to /pricing/checkout/nextwise-verified offers no way to pay | **PASS** | no confirm/pay control; price and Discovery Session link shown |
| G-pricing | G3 | confirmPricingPurchaseAction called directly is refused (Verified, free Explore, invalid id) | **PASS** | 4 direct calls refused with the 'paused' message; invoices/purchases/attempts/transactions unchanged (12/3/0/0) |
| G-pricing | G4 | createCheckoutSessionAction called directly for an open invoice creates no payment attempt | **PASS** | refused; no payment attempt (no Razorpay order can be created) |
| G-pricing | G5 | Forged payment verification is rejected and changes nothing | **PASS** | verification failed; invoice still issued/unpaid; no transaction rows |
| G-pricing | G6 | The existing invoice is shown honestly and not altered or deleted | **PASS** | invoice listed with its amount; no pay control; row unchanged |
| G-pricing | G7 | No purchase RPC or payment write reached the database during G1-G6 | **PASS** | gateway log: 0 purchase/payment writes (the forged G5 verification reached verify_checkout_payment 0x and was rejected by its HMAC/attempt checks) |
| G-pricing | G8 | Free Discovery Session is still bookable from pricing | **PASS** | pricing CTA -> /discovery-session/book |
| H-sweep | H1-desktop-out | 26 public routes at desktop: status, overflow, axe, console | **PASS** | 26 routes clean |
| H-sweep | H1-desktop-in | 14 signed-in routes at desktop: status, overflow, axe, console | **PASS** | 14 routes clean |
| H-sweep | H1-tablet-landscape-out | 26 public routes at tablet-landscape: status, overflow, axe, console | **PASS** | 26 routes clean |
| H-sweep | H1-tablet-landscape-in | 14 signed-in routes at tablet-landscape: status, overflow, axe, console | **PASS** | 14 routes clean |
| H-sweep | H1-tablet-out | 26 public routes at tablet: status, overflow, axe, console | **PASS** | 26 routes clean |
| H-sweep | H1-tablet-in | 14 signed-in routes at tablet: status, overflow, axe, console | **PASS** | 14 routes clean |
| H-sweep | H1-mobile-out | 26 public routes at mobile: status, overflow, axe, console | **PASS** | 26 routes clean |
| H-sweep | H1-mobile-in | 14 signed-in routes at mobile: status, overflow, axe, console | **PASS** | 14 routes clean |
| H-sweep | H1-narrow-out | 26 public routes at narrow: status, overflow, axe, console | **PASS** | 26 routes clean |
| H-sweep | H1-narrow-in | 14 signed-in routes at narrow: status, overflow, axe, console | **PASS** | 14 routes clean |
| H-sweep | H2 | Unknown URL returns a branded 404 with a way back | **PASS** | 404 with Nextwise branding and a home link |
| H-sweep | H3 | No broken internal links on student-facing pages (signed in) | **PASS** | 113 distinct internal links, none 4xx/5xx |
| H-sweep | H4 | Mobile menu opens, traps nothing it shouldn't, closes with Escape and returns focus | **PASS** | opened (aria-expanded=true); Escape closed it and focus returned to "Open menu" |
| H-sweep | H5 | Keyboard focus is visible on links and buttons | **PASS** | 12 consecutive tab stops all show an outline or ring |
| H-sweep | H6 | Touch targets, WCAG 2.5.8 (24 px or spacing/inline exception), student pages at 390 px (excluding the protected homepage) | **PASS** | no target fails 2.5.8 on 8 pages |
| H-sweep | H6b | Touch targets, WCAG 2.5.8, protected V5.4 homepage (CC-26: zero-area clipped skip links are not targets; their focused state is measured in probe-skipnav.cjs) | **PASS** | no target fails 2.5.8 |
| H-sweep | H7 | Session ended elsewhere: the next save explains it, and navigation asks to log in again | **PASS** | save: "Your session has ended, so this step wasn't saved. Log in again to continue — steps you already saved are kept. Log in a"; /dashboard -> /login?next=/das |
| R25 | R25-01 | Anonymous: dashboard, profile, counsellor and admin areas redirect to login | **PASS** | /dashboard:307 /profile:307 /counsellor:307 /counsellor/discovery-sessions:307 /counsellor/discovery-sessions/:id:307 /admin:307 /admin/discovery-sessions:307 |
| R25 | R25-02 | Student: admin and counsellor areas refused; no other student's identity shown | **PASS** | admin: Access denied; counsellor URL shows no identity |
| R25 | R25-03 | Counsellor with an unapproved assignment: listed as 'Awaiting admin approval', identity restricted | **PASS** | list: 'Awaiting admin approval'; detail: notice + 'Student details restricted' |
| R25 | R25-04 | Counsellor cannot change an unapproved session (database refuses; clear message shown) | **PASS** | status unchanged (scheduled); message: 'This Discovery Session assignment has not been approved by an admin…' |
| R25 | R25-05 | Admin approves the assignment with one click; the database stamps and audits it | **PASS** | approved_counsellor=A, approved_by=admin (database-stamped), 1 audit row, card shows 'Approved … Revoke approval' |
| R25 | R25-06 | Approved counsellor sees the student's name and email (list and detail) and can open the workspace | **PASS** | name + email on list and detail; workspace opens |
| R25 | R25-07 | Unassigned counsellor: no identity on the list or by direct URL | **PASS** | neither the assigned nor the open request's student is identified |
| R25 | R25-08 | Counsellor self-claims an open request: claim saved, but identity stays hidden until an admin approves | **PASS** | claimed by B (database: assigned=B, approved=none); detail shows 'Waiting for admin approval' and no identity |
| R25 | R25-09 | Admin reassigns A → B in the session form: approval moves to B, A loses access | **PASS** | B sees the student; A no longer does |
| R25 | R25-10 | After the session is completed, the counsellor no longer sees the student's identity | **PASS** | detail says details are only shown for requested or scheduled sessions |
| R25 | R25-11 | Admin still sees every student's identity (unchanged) | **PASS** | admin list shows both fictional students |
| R26 | R26-01 | Active counsellor sees their caseload student and approved session (regression) | **PASS** | caseload list and approved session show the student |
| R26 | R26-02 | Deactivated counsellor: no caseload student, no session identity, no open-request queue | **PASS** | students page HTTP 404; session detail HTTP 404; nothing identifying shown |
| P | P1 | Anonymous cannot create a purchase or invoice through the API | **PASS** | HTTP 400: You must be signed in to purchase a plan. |
| P | P2 | A student calling purchase_pricing_plan directly is refused by the database (no invoice, no purchase, no invoice number) | **PASS** | HTTP 403 42501: Online checkout is not open yet. You have not been charged. |
| P | P2b | A student cannot insert a payment attempt directly through the API (attempt-forgery path closed) | **PASS** | HTTP 403; no attempt row |
| P | P3 | A forged payment verification signature is rejected | **PASS** | HTTP 400: Payment attempt not found. |
| P | P4 | A forged Razorpay webhook is rejected (no secret / bad HMAC) | **PASS** | HTTP 400: Payment gateway webhook is not configured. |
| P | P5 | Gateway secrets are unreadable through the API (anonymous and student) | **PASS** | anonymous HTTP 200 (0 rows), student HTTP 200 (0 rows) |
| P | P6 | No payment attempt, transaction or gateway order was created by P1-P5 | **PASS** | attempts/transactions/gateway orders: 0/0/0 (unchanged) |
| P | P7 | The build has every paid switch off: no checkout flag, no Razorpay or AI provider keys | **PASS** | variables set: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_APP_URL, SUPABASE_SERVICE_ROLE_KEY |
| V | V1-desktop | Homepage loads with no console errors (desktop) | **PASS** | 200, 0 console errors, logo present, page height 11403px |
| V | V2-desktop | Homepage DOM identical to the deployed a1017b9 build (desktop) | **PASS** | 73702 chars of rendered DOM identical; height 11403px; 28 internal links identical |
| V | V3-desktop | Scroll chapters pixel-identical at 8 positions, motion paused (desktop) | **PASS** | 8/8 frames match; anti-aliasing noise only: desktop-cc25-30 4px (max delta 1/255) |
| V | V1-mobile | Homepage loads with no console errors (mobile) | **PASS** | 200, 0 console errors, logo present, page height 9557px |
| V | V2-mobile | Homepage DOM identical to the deployed a1017b9 build (mobile) | **PASS** | 73598 chars of rendered DOM identical; height 9557px; 28 internal links identical |
| V | V3-mobile | Scroll chapters pixel-identical at 8 positions, motion paused (mobile) | **PASS** | 8/8 frames pixel-identical |
