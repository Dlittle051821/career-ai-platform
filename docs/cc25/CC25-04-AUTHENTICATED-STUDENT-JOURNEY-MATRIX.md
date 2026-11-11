# CC25-04: Authenticated student journey matrix

Generated from the final CC-25 browser run (`evidence/final/results.jsonl`).

**Environment:** the CC-25 production build (`next build`, then `next start`) with payment and AI variables unset, on a local disposable stack:
- PostgreSQL 16 with migrations 0001-0022 and the **proposed CC-25 0023 applied locally**;
- real GoTrue (auth) and PostgREST (API), and a local mail catcher;
- fictional `@example.test` data only.

Tests ran in Chromium (Playwright) with axe-core, at 1440, 1024, 768, 390 and 320 px. Suite V compares against the unmodified `a1017b9` build.

**These are local results.** They don't prove how the QA Preview behaves; QA and the Preview are NOT RUN (CC25-07).

## 1. Summary: 121 checks, **119 PASS, 1 FAIL, 1 BLOCKED**

| Area | PASS | FAIL | BLOCKED |
|---|---|---|---|
| Registration and authentication | 19 | 0 | 0 |
| Student profile (onboarding wizard) | 17 | 0 | 0 |
| Career discovery and dashboard | 10 | 0 | 1 |
| Abroad: universities, courses, saved, applications | 10 | 0 | 0 |
| Discovery Sessions (student, admin, counsellor) | 13 | 0 | 0 |
| Pricing and payment safety (UI and server actions) | 10 | 0 | 0 |
| Responsive, accessibility, errors, session expiry | 16 | 1 | 0 |
| Roles: counsellor identity, approval, admin, isolation | 11 | 0 | 0 |
| Payment safety at the API level | 7 | 0 | 0 |
| V5.4 homepage regression | 6 | 0 | 0 |
| **Total** | **119** | **1** | **1** |

## 2. Every check

| ID | Check (the expected result) | Role | Actual | Result | Evidence |
|---|---|---|---|---|---|
| B1-desktop | Registration page opens (desktop) | Anonymous / new / returning student | 200, no overflow, axe clean | **PASS** | `suite-b-auth.log` |
| B2-desktop | Empty submit shows field errors and focuses the first (desktop) | Anonymous / new / returning student | 5 fields flagged, focus on full name, errors linked by aria-describedby (Check now waits up to 2 s for focus (run 1 read it in the same tick; CC25-05 section 4).) | **PASS** | `suite-b-auth.log` |
| B1-mobile | Registration page opens (mobile) | Anonymous / new / returning student | 200, no overflow, axe clean | **PASS** | `suite-b-auth.log` |
| B2-mobile | Empty submit shows field errors and focuses the first (mobile) | Anonymous / new / returning student | 5 fields flagged, focus on full name, errors linked by aria-describedby (Check now waits up to 2 s for focus (run 1 read it in the same tick; CC25-05 section 4).) | **PASS** | `suite-b-auth.log` |
| B3 | Invalid email and weak password give useful errors | Anonymous / new / returning student | email, password and phone errors shown | **PASS** | `suite-b-auth.log` |
| B4 | Successful registration: honest 'check your email', confirmation email, link signs in | Anonymous / new / returning student | profile created, 1 confirmation email (local catcher), link -> /auth/callback -> /welcome | **PASS** | `suite-b-auth.log` |
| B5 | Existing email: message does not reveal whether an account exists | Anonymous / new / returning student | same neutral 'check your email' response as a new account | **PASS** | `suite-b-auth.log` |
| B6-desktop | Login with a valid account lands on the dashboard (desktop) | Anonymous / new / returning student | redirected to /dashboard without an error | **PASS** | `suite-b-auth.log` |
| B6-mobile | Login with a valid account lands on the dashboard (mobile) | Anonymous / new / returning student | redirected to /dashboard without an error | **PASS** | `suite-b-auth.log` |
| B7 | Wrong password and unknown email get the same safe error | Anonymous / new / returning student | "Email or password is incorrect." | **PASS** | `suite-b-auth.log` |
| B7b | Login before confirming email explains what to do | Anonymous / new / returning student | "Please confirm your email address first — check your inbox for a confirmation link." | **PASS** | `suite-b-auth.log` |
| B8-desktop | Logout ends the session (desktop) | Anonymous / new / returning student | auth cookie cleared; /dashboard now redirects to /login | **PASS** | `suite-b-auth.log` |
| B8-mobile | Logout ends the session (mobile) | Anonymous / new / returning student | auth cookie cleared; /dashboard now redirects to /login | **PASS** | `suite-b-auth.log` |
| B9 | Password reset: neutral message, emailed link, new password works | Anonymous / new / returning student | same message for known/unknown email; link -> /reset-password; new password accepted by GoTrue | **PASS** | `suite-b-auth.log` |
| B9b | Expired or invalid reset link shows a clear message | Anonymous / new / returning student | lands on /reset-password?authError=1 with an explanation | **PASS** | `suite-b-auth.log` |
| B10 | Protected routes redirect signed-out visitors (17 routes) | Anonymous / new / returning student | all 307 -> /login?next=<route> | **PASS** | `suite-b-auth.log` |
| B11 | A safe ?next returns the student to the intended page | Anonymous / new / returning student | /login?next=/studio/career -> /studio/career | **PASS** | `suite-b-auth.log` |
| B12 | External or malicious ?next values are rejected (login form) | Anonymous / new / returning student | 7 payloads all stayed on http://localhost:3025 (landed on /dashboard) | **PASS** | `suite-b-auth.log` |
| B12b | Auth callback ignores external ?next | Anonymous / new / returning student | every redirect stays on the app origin | **PASS** | `suite-b-auth.log` |
| C1 | Wizard opens at step 1 for a new student; layout and accessibility | New student | About You, axe clean | **PASS** | `suite-c-onboarding.log` |
| C2 | All 11 data steps save and advance; each step's data is in the database | New student | 11 steps saved (rows verified per table); onboarding_current_step=12 | **PASS** | `suite-c-onboarding.log` |
| C3 | Back navigation keeps earlier answers | New student | step 3 shows Mathematics still selected | **PASS** | `suite-c-onboarding.log` |
| C4 | Review step lists the answers and Edit returns to the right step | New student | review shows saved answers; Edit -> Education | **PASS** | `suite-c-onboarding.log` |
| C5 | Completing the profile reaches the dashboard and records completion | New student | landed /profile; profile completed 100 | **PASS** | `suite-c-onboarding.log` |
| C6 | Save & Exit at step 4, then resume where the student left off (mobile) | New student | saved, landed on /dashboard, resumed at Interests with selections restored | **PASS** | `suite-c-onboarding.log` |
| C7 | Phone layout: no sideways scroll on the wizard (390 px) | New student | 0 px | **PASS** | `suite-c-onboarding.log` |
| C8 | Future date of birth is rejected with a message and no save | New student | "Please enter a valid date of birth." | **PASS** | `suite-c-onboarding.log` |
| C9 | Started education entry without a level is rejected | New student | "Please select an education level for each entry you've started, or remove the empty ones." | **PASS** | `suite-c-onboarding.log` |
| C10 | Started experience entry without a title is rejected | New student | "Please add a title for each entry you've started, or remove the empty ones." | **PASS** | `suite-c-onboarding.log` |
| C11 | Required (*) markers are explained; a partial step can still be saved (design check) | New student | legend shown under the step heading; Continue saves the partial step (completion is checked on Review) | **PASS** | `suite-c-onboarding.log` |
| C12 | Completing with required sections missing explains what to finish | New student | blocked: "Please complete these sections first: About You, Education, Subject Strengths, Interests, Skills, Work Preferences, Career Priorities, Career Goals, Study & Location, Budget & Funding." | **PASS** | `suite-c-onboarding.log` |
| C13 | Server-side save failure keeps the answers and allows a retry | New student | error "We couldn't save your changes. Please try again."; selections kept; retry saved and advanced | **PASS** | `suite-c-onboarding.log` |
| C14 | Lost connection in the browser shows a recoverable message | New student | "We couldn't reach Nextwise to save this step. Your answers are still here — check your connection and try again." | **PASS** | `suite-c-onboarding.log` |
| C15 | Slow save: button shows progress and double-clicks cause one save | New student | busy state shown; exactly one write | **PASS** | `suite-c-onboarding.log` |
| C16 | Keyboard: step 1 can be completed without a mouse, and focus moves to the new step | New student | completed with keyboard; focus ring true; focus -> H1 Education | **PASS** | `suite-c-onboarding.log` |
| C17 | 320 px: wizard steps fit without sideways scroll; axe clean | New student | steps 1, 3, 6, 9, 12 fit at 320 px with no serious axe issues | **PASS** | `suite-c-onboarding.log` |
| D1-desktop | Career hub and career list render (desktop) | Anonymous / student | 9 public career/abroad pages: 200, no overflow, no serious axe issues, no console errors | **PASS** | `suite-de-explore.log` |
| D1-mobile | Career hub and career list render (mobile) | Anonymous / student | 9 public career/abroad pages: 200, no overflow, no serious axe issues, no console errors | **PASS** | `suite-de-explore.log` |
| D1-narrow | Career hub and career list render (narrow) | Anonymous / student | 9 public career/abroad pages: 200, no overflow, no serious axe issues, no console errors | **PASS** | `suite-de-explore.log` |
| D2 | Career search: results, and an honest empty state | Anonymous / student | 'engineer' -> 20 links; nonsense query -> empty-state message | **PASS** | `suite-de-explore.log` |
| D3 | Unknown career slug returns a real 404 (not a soft 404) | Anonymous / student | 404 | **PASS** | `suite-de-explore.log` |
| D4 | Career comparison shows both careers | Anonymous / student | both careers rendered side by side | **PASS** | `suite-de-explore.log` |
| D5 | Public career/abroad pages do not promise AI or counsellor-verified recommendations | Anonymous / student | no AI / counsellor-verified / guarantee claims found on 11 pages | **PASS** | `suite-de-explore.log` |
| D6 | Dashboard: every navigation link resolves | Anonymous / student | 14 links on the dashboard, none 4xx/5xx | **PASS** | `suite-de-explore.log` |
| D7 | /studio/career opens the career workspace (dashboard) | Anonymous / student | redirects to /dashboard (career workspace by design) | **PASS** | `suite-de-explore.log` |
| D8 | Recommendation reports: honest state when the reports function is unavailable | Anonymous / student | page shows 'temporarily unavailable' (honest). Live reports need NW07 get_my_recommendation_reports, not in migrations 0001-0022 (Needs proposed NW07 (not in 0001-0022); honest unavailable state shown.) | **BLOCKED** | `suite-de-explore.log` |
| D9 | Recommendations page for a student without a profile does not imply ready recommendations | Anonymous / student | "GOOD EVENING, FICTIONAL 👋 Your personalised recommendations Based on your profile, interests, academic background, and career goals — plus how reliab" | **PASS** | `suite-de-explore.log` |
| E1 | Universities list: only published records; badges match verification status; rankings only when verified | Anonymous / student | draft hidden; Liffey and Polder labelled 'Not yet verified'; Northbridge (verified) not labelled | **PASS** | `suite-de-explore.log` |
| E2 | University detail: unverified note on unverified records; ranking hidden unless verified | Anonymous / student | Liffey shows the unverified note and no ranking; Northbridge shows neither warning | **PASS** | `suite-de-explore.log` |
| E3 | Draft university and unknown slugs are not found | Anonymous / student | 404 for draft university, unknown university, unpublished course | **PASS** | `suite-de-explore.log` |
| E4 | Course filters: text, destination, degree level, and empty results | Anonymous / student | all 4, q=Design 2, country=Germany 2, masters 2, nonsense 0 with empty-state message. Note P2: ?destination=DE (used by the 'Explore a launch country' chips) lists 4 courses, i.e. does not filter the list | **PASS** | `suite-de-explore.log` |
| E5 | Course detail: unverified course labelled; verified course shows last verified | Anonymous / student | needs-review course labelled; verified course shows 'Last verified' | **PASS** | `suite-de-explore.log` |
| E6 | Course comparison works for two courses | Anonymous / student | two courses compared on /courses/compare | **PASS** | `suite-de-explore.log` |
| E7 | Saving a course appears in Saved | Anonymous / student | 1 saved row; listed on /saved | **PASS** | `suite-de-explore.log` |
| E8 | Abroad studio and applications: empty states without errors | Anonymous / student | studio and 'No Abroad applications yet' render. Live application tasks (NW06/NW07) not exercised: deferred | **PASS** | `suite-de-explore.log` |
| E9 | Application detail for a non-existent application is handled | Anonymous / student | status 200 (Shows the not-found screen but with HTTP 200 (soft 404 on an authenticated, noindex page): P3, CC25-08.) | **PASS** | `suite-de-explore.log` |
| E10 | Course list when the database is unreachable shows a calm error, not a crash | Anonymous / student | status 200: "COURSE EXPLORER Browse courses Search and filter a starter dataset of university courses — subject, qualification level," | **PASS** | `suite-de-explore.log` |
| F1-desktop | Public free-session page renders and leads to the request form (desktop) | Student, admin, assigned counsellor | 200, no overflow, axe clean, no confirmed-slot wording | **PASS** | `suite-f-discovery.log` |
| F1-mobile | Public free-session page renders and leads to the request form (mobile) | Student, admin, assigned counsellor | 200, no overflow, axe clean, no confirmed-slot wording | **PASS** | `suite-f-discovery.log` |
| F1-narrow | Public free-session page renders and leads to the request form (narrow) | Student, admin, assigned counsellor | 200, no overflow, axe clean, no confirmed-slot wording | **PASS** | `suite-f-discovery.log` |
| F2 | Signed-out visitor is sent to log in and returned to the request form | Student, admin, assigned counsellor | /discovery-session/book -> /login?next=… -> back to the form after login | **PASS** | `suite-f-discovery.log` |
| F3 | Request form: contact method, time of day and language; honest success message | Student, admin, assigned counsellor | row saved as 'requested' (whatsapp/evening/Odia, no time); copy says it is a request, not a booked slot, and that no notifications are sent | **PASS** | `suite-f-discovery.log` |
| F4 | Duplicate request: page shows the existing request instead of a second form | Student, admin, assigned counsellor | "You already have a Discovery Session requested A counsellor will reach out to confirm a time that works for you." | **PASS** | `suite-f-discovery.log` |
| F5 | Duplicate request via the server action directly is refused (one active request per student) | Student, admin, assigned counsellor | replayed action -> 'You already have a Discovery Session request in progress'; still 1 row | **PASS** | `suite-f-discovery.log` |
| F6 | Dashboard shows the request as requested, with no time yet | Student, admin, assigned counsellor | "Discovery Session Requested Career Guidance Session View Session Details" | **PASS** | `suite-f-discovery.log` |
| F7 | Server rejects an invalid contact method sent directly to the action | Student, admin, assigned counsellor | no row stored; generic error returned (database check constraint enforces the value) | **PASS** | `suite-f-discovery.log` |
| F8 | Very long free-text fields sent directly to the action | Student, admin, assigned counsellor | rejected | **PASS** | `suite-f-discovery.log` |
| F9 | Admin schedules 20 Nov 2026 18:30 IST from a New York browser; stored as 13:00 UTC | Student, admin, assigned counsellor | stored 2026-11-20 13:00 scheduled UTC; form re-shows 2026-11-20T18:30 (IST) in a New York browser | **PASS** | `suite-f-discovery.log` |
| F10 | Student sees the scheduled time in IST (browser in Berlin) | Student, admin, assigned counsellor | "Discovery Session Scheduled Career Guidance Session Fri, 20 Nov, 6:30 pm IST View Session Details" | **PASS** | `suite-f-discovery.log` |
| F11 | Assigned counsellor sees the session in their list | Student, admin, assigned counsellor | session listed with the student's name (Was BLOCKED in CC-24; passes with CC-25 0023 applied to the local database (admin assignment = approval).) | **PASS** | `suite-f-discovery.log` |
| G1-desktop | Pricing shows ₹1,999 tax-inclusive and no checkout links (desktop) | Anonymous / student | ₹1,999, tax included, 0 checkout links, free-session CTA present | **PASS** | `suite-g-pricing.log` |
| G1-mobile | Pricing shows ₹1,999 tax-inclusive and no checkout links (mobile) | Anonymous / student | ₹1,999, tax included, 0 checkout links, free-session CTA present | **PASS** | `suite-g-pricing.log` |
| G1-narrow | Pricing shows ₹1,999 tax-inclusive and no checkout links (narrow) | Anonymous / student | ₹1,999, tax included, 0 checkout links, free-session CTA present | **PASS** | `suite-g-pricing.log` |
| G2 | Direct visit to /pricing/checkout/nextwise-verified offers no way to pay | Anonymous / student | no confirm/pay control; price and Discovery Session link shown | **PASS** | `suite-g-pricing.log` |
| G3 | confirmPricingPurchaseAction called directly is refused (Verified, free Explore, invalid id) | Anonymous / student | 4 direct calls refused with the 'paused' message; invoices/purchases/attempts/transactions unchanged (10/2/0/0) | **PASS** | `suite-g-pricing.log` |
| G4 | createCheckoutSessionAction called directly for an open invoice creates no payment attempt | Anonymous / student | refused; no payment attempt (no Razorpay order can be created) | **PASS** | `suite-g-pricing.log` |
| G5 | Forged payment verification is rejected and changes nothing | Anonymous / student | verification failed; invoice still issued/unpaid; no transaction rows | **PASS** | `suite-g-pricing.log` |
| G6 | The existing invoice is shown honestly and not altered or deleted | Anonymous / student | invoice listed with its amount; no pay control; row unchanged | **PASS** | `suite-g-pricing.log` |
| G7 | No purchase RPC or payment write reached the database during G1-G6 | Anonymous / student | gateway log: 0 purchase/payment writes (the forged G5 verification reached verify_checkout_payment 0x and was rejected by its HMAC/attempt checks) | **PASS** | `suite-g-pricing.log` |
| G8 | Free Discovery Session is still bookable from pricing | Anonymous / student | pricing CTA -> /discovery-session/book | **PASS** | `suite-g-pricing.log` |
| H1-desktop-out | 26 public routes at desktop: status, overflow, axe, console | Anonymous / signed-in student | 26 routes clean | **PASS** | `suite-h-sweep.log` |
| H1-desktop-in | 14 signed-in routes at desktop: status, overflow, axe, console | Anonymous / signed-in student | 14 routes clean | **PASS** | `suite-h-sweep.log` |
| H1-tablet-landscape-out | 26 public routes at tablet-landscape: status, overflow, axe, console | Anonymous / signed-in student | 26 routes clean | **PASS** | `suite-h-sweep.log` |
| H1-tablet-landscape-in | 14 signed-in routes at tablet-landscape: status, overflow, axe, console | Anonymous / signed-in student | 14 routes clean | **PASS** | `suite-h-sweep.log` |
| H1-tablet-out | 26 public routes at tablet: status, overflow, axe, console | Anonymous / signed-in student | 26 routes clean | **PASS** | `suite-h-sweep.log` |
| H1-tablet-in | 14 signed-in routes at tablet: status, overflow, axe, console | Anonymous / signed-in student | 14 routes clean | **PASS** | `suite-h-sweep.log` |
| H1-mobile-out | 26 public routes at mobile: status, overflow, axe, console | Anonymous / signed-in student | 26 routes clean | **PASS** | `suite-h-sweep.log` |
| H1-mobile-in | 14 signed-in routes at mobile: status, overflow, axe, console | Anonymous / signed-in student | 14 routes clean | **PASS** | `suite-h-sweep.log` |
| H1-narrow-out | 26 public routes at narrow: status, overflow, axe, console | Anonymous / signed-in student | 26 routes clean | **PASS** | `suite-h-sweep.log` |
| H1-narrow-in | 14 signed-in routes at narrow: status, overflow, axe, console | Anonymous / signed-in student | 14 routes clean | **PASS** | `suite-h-sweep.log` |
| H2 | Unknown URL returns a branded 404 with a way back | Anonymous / signed-in student | 404 with Nextwise branding and a home link | **PASS** | `suite-h-sweep.log` |
| H3 | No broken internal links on student-facing pages (signed in) | Anonymous / signed-in student | 113 distinct internal links, none 4xx/5xx | **PASS** | `suite-h-sweep.log` |
| H4 | Mobile menu opens, traps nothing it shouldn't, closes with Escape and returns focus | Anonymous / signed-in student | opened (aria-expanded=true); Escape closed it and focus returned to "Open menu" | **PASS** | `suite-h-sweep.log` |
| H5 | Keyboard focus is visible on links and buttons | Anonymous / signed-in student | 12 consecutive tab stops all show an outline or ring | **PASS** | `suite-h-sweep.log` |
| H6 | Touch targets, WCAG 2.5.8 (24 px or spacing/inline exception), student pages at 390 px (excluding the protected homepage) | Anonymous / signed-in student | no target fails 2.5.8 on 8 pages (CC-25 measures WCAG 2.5.8 itself (spacing and inline exceptions); CC-24 used a plain size test.) | **PASS** | `suite-h-sweep.log` |
| H6b | Touch targets, WCAG 2.5.8, protected V5.4 homepage (report only; no visual change allowed) | Anonymous / signed-in student | P2 (protected V5.4 file, needs design sign-off): 6 target(s): a "Go to: One platform, two pathways" 28x1; a "Go to: Career Intelligence" 28x1; a "Go to: Study Abroad destination explorer" 28x1; a "Go to: Student Studio" 28x1; a "Go to: How we guide you" 28x1; a "Go to: Start exploring" 28x1 (Protected V5.4 file: no change allowed in CC-25; fix proposal in CC25-05 section 3.) | **FAIL** | `suite-h-sweep.log` |
| H7 | Session ended elsewhere: the next save explains it, and navigation asks to log in again | Anonymous / signed-in student | save: "Your session has ended, so this step wasn't saved. Log in again to continue — steps you already saved are kept. Log in a"; /dashboard -> /login?next=/dashboard | **PASS** | `suite-h-sweep.log` |
| R25-01 | Anonymous: dashboard, profile, counsellor and admin areas redirect to login | Anonymous, student, counsellor A/B, admin | /dashboard:307 /profile:307 /counsellor:307 /counsellor/discovery-sessions:307 /counsellor/discovery-sessions/:id:307 /admin:307 /admin/discovery-sessions:307 | **PASS** | `suite-r25-roles.log` |
| R25-02 | Student: admin and counsellor areas refused; no other student's identity shown | Anonymous, student, counsellor A/B, admin | admin: Access denied; counsellor URL shows no identity | **PASS** | `suite-r25-roles.log` |
| R25-03 | Counsellor with an unapproved assignment: listed as 'Awaiting admin approval', identity restricted | Anonymous, student, counsellor A/B, admin | list: 'Awaiting admin approval'; detail: notice + 'Student details restricted' | **PASS** | `suite-r25-roles.log` |
| R25-04 | Counsellor cannot change an unapproved session (database refuses; clear message shown) | Anonymous, student, counsellor A/B, admin | status unchanged (scheduled); message: 'This Discovery Session assignment has not been approved by an admin…' | **PASS** | `suite-r25-roles.log` |
| R25-05 | Admin approves the assignment with one click; the database stamps and audits it | Anonymous, student, counsellor A/B, admin | approved_counsellor=A, approved_by=admin (database-stamped), 1 audit row, card shows 'Approved … Revoke approval' | **PASS** | `suite-r25-roles.log` |
| R25-06 | Approved counsellor sees the student's name and email (list and detail) and can open the workspace | Anonymous, student, counsellor A/B, admin | name + email on list and detail; workspace opens | **PASS** | `suite-r25-roles.log` |
| R25-07 | Unassigned counsellor: no identity on the list or by direct URL | Anonymous, student, counsellor A/B, admin | neither the assigned nor the open request's student is identified | **PASS** | `suite-r25-roles.log` |
| R25-08 | Counsellor self-claims an open request: claim saved, but identity stays hidden until an admin approves | Anonymous, student, counsellor A/B, admin | claimed by B (database: assigned=B, approved=none); detail shows 'Waiting for admin approval' and no identity | **PASS** | `suite-r25-roles.log` |
| R25-09 | Admin reassigns A → B in the session form: approval moves to B, A loses access | Anonymous, student, counsellor A/B, admin | B sees the student; A no longer does | **PASS** | `suite-r25-roles.log` |
| R25-10 | After the session is completed, the counsellor no longer sees the student's identity | Anonymous, student, counsellor A/B, admin | detail says details are only shown for requested or scheduled sessions | **PASS** | `suite-r25-roles.log` |
| R25-11 | Admin still sees every student's identity (unchanged) | Anonymous, student, counsellor A/B, admin | admin list shows both fictional students | **PASS** | `suite-r25-roles.log` |
| P1 | Anonymous cannot create a purchase or invoice through the API | Anonymous / student (direct API) | HTTP 400: You must be signed in to purchase a plan. | **PASS** | `suite-p-payment-api.log` |
| P2 | A student calling purchase_pricing_plan directly gets at most an unpaid invoice at exactly ₹1,999 — never a charge | Anonymous / student (direct API) | P2 note: the database RPC is reachable by any signed-in student and issues an unpaid invoice (issued:199900:INR); no payment attempt, no gateway order. Paying still requires the gated server checkout (closed). Tracked: NW01 / CC-19/CC-20 GST work. | **PASS** | `suite-p-payment-api.log` |
| P3 | A forged payment verification signature is rejected | Anonymous / student (direct API) | HTTP 400: Payment attempt not found. | **PASS** | `suite-p-payment-api.log` |
| P4 | A forged Razorpay webhook is rejected (no secret / bad HMAC) | Anonymous / student (direct API) | HTTP 400: Payment gateway webhook is not configured. | **PASS** | `suite-p-payment-api.log` |
| P5 | Gateway secrets are unreadable through the API (anonymous and student) | Anonymous / student (direct API) | anonymous HTTP 200 (0 rows), student HTTP 200 (0 rows) | **PASS** | `suite-p-payment-api.log` |
| P6 | No payment attempt, transaction or gateway order was created by P1-P5 | Anonymous / student (direct API) | attempts\|transactions\|gateway orders: 0\|0\|0 (unchanged) | **PASS** | `suite-p-payment-api.log` |
| P7 | The build has every paid switch off: no checkout flag, no Razorpay or AI provider keys | Anonymous / student (direct API) | variables set: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_APP_URL, SUPABASE_SERVICE_ROLE_KEY | **PASS** | `suite-p-payment-api.log` |
| V1-desktop | Homepage loads with no console errors (desktop) | Anonymous | 200, 0 console errors, logo present, page height 11403px | **PASS** | `suite-v-homepage.log` |
| V2-desktop | Homepage DOM identical to the deployed a1017b9 build (desktop) | Anonymous | 73702 chars of rendered DOM identical; height 11403px; 28 internal links identical | **PASS** | `suite-v-homepage.log` |
| V3-desktop | Scroll chapters pixel-identical at 8 positions, motion paused (desktop) | Anonymous | 8/8 frames match; anti-aliasing noise only: desktop-cc25-30 4px (max delta 1/255) | **PASS** | `suite-v-homepage.log` |
| V1-mobile | Homepage loads with no console errors (mobile) | Anonymous | 200, 0 console errors, logo present, page height 9557px | **PASS** | `suite-v-homepage.log` |
| V2-mobile | Homepage DOM identical to the deployed a1017b9 build (mobile) | Anonymous | 73598 chars of rendered DOM identical; height 9557px; 28 internal links identical | **PASS** | `suite-v-homepage.log` |
| V3-mobile | Scroll chapters pixel-identical at 8 positions, motion paused (mobile) | Anonymous | 8/8 frames pixel-identical | **PASS** | `suite-v-homepage.log` |

## 3. Not run or blocked outside the browser run

| Scenario | Status | Why |
|---|---|---|
| Any journey on the QA Preview (signed in) | **NOT RUN** | No CC-25 Preview exists (needs push and authorization, CC25-07). Manual checklist: CC25-09 section 4 |
| Real email delivery (QA SMTP); QA Site URL and redirect allow-list | **NOT RUN** | Remote QA configuration. Local GoTrue with a mail catcher only (B4, B9) |
| Counsellor identity on QA | **BLOCKED** | Needs QA migration 0023 (your approval, CC25-02 section 8). Verified locally (R25, CC25-03) |
| Recommendation reports with data; live application tasks | **BLOCKED** | Need the proposed NW06/NW07 migrations |
| Firefox, Edge, Safari/macOS, iOS Safari, Android | **NOT RUN** | Chromium only in the test environment (CC25-05 section 1) |
| Screen readers | **NOT RUN** | axe and keyboard checks only |

