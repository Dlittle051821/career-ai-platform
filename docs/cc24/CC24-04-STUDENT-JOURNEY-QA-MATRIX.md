# CC24-04 — Student journey QA matrix

Generated from the final browser run (`evidence/final/results.jsonl`), executed against the CC-24 production build (`next build` + `next start`, payments and AI variables unset) on the local disposable stack: PostgreSQL 16 with migrations 0001–0022, real GoTrue v2.180.0 and PostgREST v12.2.3, a local mail catcher, and fictional `@example.test` data. Chromium (Playwright), axe-core 4.10.2; 1440 / 390 / 320 px; Asia/Kolkata, America/New_York and Europe/Berlin browsers. Suite V compares against the unmodified `a1017b9` build.

**Not proof of hosted behaviour.** QA/production configuration, real email delivery, Safari/iOS, Firefox, real devices and screen readers were not tested (see §3).

## 1. Summary — 107 checks: **104 PASS · 1 FAIL · 2 BLOCKED**

| Area | PASS | FAIL | BLOCKED |
|---|---|---|---|
| A1–A2 Registration & authentication | 19 | 0 | 0 |
| A3–A4 Onboarding & profile | 17 | 0 | 0 |
| D Career discovery & dashboard | 10 | 0 | 1 |
| D University & course discovery | 10 | 0 | 0 |
| C Discovery Session booking | 12 | 0 | 1 |
| F Pricing & payment safety | 10 | 0 | 0 |
| G Responsive design, accessibility, errors | 11 | 1 | 0 |
| B/F Role isolation & counsellor identity | 9 | 0 | 0 |
| V5.4 homepage regression | 6 | 0 | 0 |
| **Total** | **104** | **1** | **2** |

## 2. Scenarios

Each scenario title states the expected result.

| ID | Scenario (expected result) | User role | Actual result | Result | Evidence |
|---|---|---|---|---|---|
| B1-desktop | Registration page opens (desktop) | Anonymous | 200, no overflow, axe clean | **PASS** | `suite-b-auth.log` |
| B2-desktop | Empty submit shows field errors and focuses the first (desktop) | Anonymous | 5 fields flagged, focus on full name, errors linked by aria-describedby | **PASS** | `suite-b-auth.log` |
| B1-mobile | Registration page opens (mobile) | Anonymous | 200, no overflow, axe clean | **PASS** | `suite-b-auth.log` |
| B2-mobile | Empty submit shows field errors and focuses the first (mobile) | Anonymous | 5 fields flagged, focus on full name, errors linked by aria-describedby | **PASS** | `suite-b-auth.log` |
| B3 | Invalid email and weak password give useful errors | Anonymous | email, password and phone errors shown | **PASS** | `suite-b-auth.log` |
| B4 | Successful registration: honest 'check your email', confirmation email, link signs in | New student | profile created, 1 confirmation email (local catcher), link -> /auth/callback -> /welcome | **PASS** | `suite-b-auth.log` |
| B5 | Existing email: message does not reveal whether an account exists | Anonymous | same neutral 'check your email' response as a new account | **PASS** | `suite-b-auth.log` |
| B6-desktop | Login with a valid account lands on the dashboard (desktop) | Returning student | redirected to /dashboard without an error | **PASS** | `suite-b-auth.log` |
| B6-mobile | Login with a valid account lands on the dashboard (mobile) | Returning student | redirected to /dashboard without an error | **PASS** | `suite-b-auth.log` |
| B7 | Wrong password and unknown email get the same safe error | Anonymous | "Email or password is incorrect." | **PASS** | `suite-b-auth.log` |
| B7b | Login before confirming email explains what to do | New student (unconfirmed) | "Please confirm your email address first — check your inbox for a confirmation link." | **PASS** | `suite-b-auth.log` |
| B8-desktop | Logout ends the session (desktop) | Returning student | auth cookie cleared; /dashboard now redirects to /login | **PASS** | `suite-b-auth.log` |
| B8-mobile | Logout ends the session (mobile) | Returning student | auth cookie cleared; /dashboard now redirects to /login | **PASS** | `suite-b-auth.log` |
| B9 | Password reset: neutral message, emailed link, new password works | Returning student | same message for known/unknown email; link -> /reset-password; new password accepted by GoTrue | **PASS** | `suite-b-auth.log` |
| B9b | Expired or invalid reset link shows a clear message | Anonymous | lands on /reset-password?authError=1 with an explanation | **PASS** | `suite-b-auth.log` |
| B10 | Protected routes redirect signed-out visitors (17 routes) | Anonymous | all 307 -> /login?next=<route> | **PASS** | `suite-b-auth.log` |
| B11 | A safe ?next returns the student to the intended page | Returning student | /login?next=/studio/career -> /studio/career | **PASS** | `suite-b-auth.log` |
| B12 | External or malicious ?next values are rejected (login form) | Anonymous | 7 payloads all stayed on http://localhost:3023 (landed on /dashboard) | **PASS** | `suite-b-auth.log` |
| B12b | Auth callback ignores external ?next | Anonymous | every redirect stays on the app origin | **PASS** | `suite-b-auth.log` |
| C1 | Wizard opens at step 1 for a new student; layout and accessibility | Newly registered student | About You, axe clean | **PASS** | `suite-c-onboarding.log` |
| C2 | All 11 data steps save and advance; each step's data is in the database | Newly registered student | 11 steps saved (rows verified per table); onboarding_current_step=12 | **PASS** | `suite-c-onboarding.log` |
| C3 | Back navigation keeps earlier answers | Newly registered student | step 3 shows Mathematics still selected | **PASS** | `suite-c-onboarding.log` |
| C4 | Review step lists the answers and Edit returns to the right step | Newly registered student | review shows saved answers; Edit -> Education | **PASS** | `suite-c-onboarding.log` |
| C5 | Completing the profile reaches the dashboard and records completion | Newly registered student | landed /profile; profile completed 100 | **PASS** | `suite-c-onboarding.log` |
| C6 | Save & Exit at step 4, then resume where the student left off (mobile) | Newly registered student | saved, landed on /dashboard, resumed at Interests with selections restored | **PASS** | `suite-c-onboarding.log` |
| C7 | Phone layout: no sideways scroll on the wizard (390 px) | Newly registered student | 0 px | **PASS** | `suite-c-onboarding.log` |
| C8 | Future date of birth is rejected with a message and no save | Newly registered student | "Please enter a valid date of birth." | **PASS** | `suite-c-onboarding.log` |
| C9 | Started education entry without a level is rejected | Newly registered student | "Please select an education level for each entry you've started, or remove the empty ones." | **PASS** | `suite-c-onboarding.log` |
| C10 | Started experience entry without a title is rejected | Newly registered student | "Please add a title for each entry you've started, or remove the empty ones." | **PASS** | `suite-c-onboarding.log` |
| C11 | Required (*) markers are explained; a partial step can still be saved (design check) | Newly registered student | legend shown under the step heading; Continue saves the partial step (completion is checked on Review) — *Criterion updated in CC-24: by design partial steps save (brief A3); the check now requires the * legend to be shown (CC-23 flagged the unexplained marker).* | **PASS** | `suite-c-onboarding.log` |
| C12 | Completing with required sections missing explains what to finish | Newly registered student | blocked: "Please complete these sections first: About You, Education, Subject Strengths, Interests, Skills, Work Preferences, Career Priorities, Career Goals, Study & Location, Budget & Funding." | **PASS** | `suite-c-onboarding.log` |
| C13 | Server-side save failure keeps the answers and allows a retry | Newly registered student | error "We couldn't save your changes. Please try again."; selections kept; retry saved and advanced | **PASS** | `suite-c-onboarding.log` |
| C14 | Lost connection in the browser shows a recoverable message | Newly registered student | "We couldn't reach Nextwise to save this step. Your answers are still here — check your connection and try again." | **PASS** | `suite-c-onboarding.log` |
| C15 | Slow save: button shows progress and double-clicks cause one save | Newly registered student | busy state shown; exactly one write | **PASS** | `suite-c-onboarding.log` |
| C16 | Keyboard: step 1 can be completed without a mouse, and focus moves to the new step | Newly registered student | completed with keyboard; focus ring true; focus -> H1 Education | **PASS** | `suite-c-onboarding.log` |
| C17 | 320 px: wizard steps fit without sideways scroll; axe clean | Newly registered student | steps 1, 3, 6, 9, 12 fit at 320 px with no serious axe issues | **PASS** | `suite-c-onboarding.log` |
| D1-desktop | Career hub and career list render (desktop) | Anonymous | 9 public career/abroad pages: 200, no overflow, no serious axe issues, no console errors | **PASS** | `suite-de-explore.log` |
| D1-mobile | Career hub and career list render (mobile) | Anonymous | 9 public career/abroad pages: 200, no overflow, no serious axe issues, no console errors | **PASS** | `suite-de-explore.log` |
| D1-narrow | Career hub and career list render (narrow) | Anonymous | 9 public career/abroad pages: 200, no overflow, no serious axe issues, no console errors | **PASS** | `suite-de-explore.log` |
| D2 | Career search: results, and an honest empty state | Anonymous | 'engineer' -> 20 links; nonsense query -> empty-state message | **PASS** | `suite-de-explore.log` |
| D3 | Unknown career slug returns a real 404 (not a soft 404) | Anonymous | 404 — *Fixed in CC-24 (D04): was 200 at a1017b9.* | **PASS** | `suite-de-explore.log` |
| D4 | Career comparison shows both careers | Anonymous | both careers rendered side by side | **PASS** | `suite-de-explore.log` |
| D5 | Public career/abroad pages do not promise AI or counsellor-verified recommendations | Anonymous | no AI / counsellor-verified / guarantee claims found on 11 pages | **PASS** | `suite-de-explore.log` |
| D6 | Dashboard: every navigation link resolves | Anonymous / returning student | 14 links on the dashboard, none 4xx/5xx | **PASS** | `suite-de-explore.log` |
| D7 | /studio/career opens the career workspace (dashboard) | Anonymous / returning student | redirects to /dashboard (career workspace by design) | **PASS** | `suite-de-explore.log` |
| D8 | Recommendation reports: honest state when the reports function is unavailable | Anonymous / returning student | page shows 'temporarily unavailable' (honest). Live reports need NW07 get_my_recommendation_reports, not in migrations 0001-0022 | **BLOCKED** | `suite-de-explore.log` |
| D9 | Recommendations page for a student without a profile does not imply ready recommendations | Anonymous / returning student | "GOOD EVENING, FICTIONAL 👋 Your personalised recommendations Based on your profile, interests, academic background, and career goals — plus how reliab" | **PASS** | `suite-de-explore.log` |
| E1 | Universities list: only published records; badges match verification status; rankings only when verified | Anonymous / returning student | draft hidden; Liffey and Polder labelled 'Not yet verified'; Northbridge (verified) not labelled | **PASS** | `suite-de-explore.log` |
| E2 | University detail: unverified note on unverified records; ranking hidden unless verified | Anonymous / returning student | Liffey shows the unverified note and no ranking; Northbridge shows neither warning | **PASS** | `suite-de-explore.log` |
| E3 | Draft university and unknown slugs are not found | Anonymous / returning student | 404 for draft university, unknown university, unpublished course — *Fixed in CC-24 (D04): was 200 at a1017b9.* | **PASS** | `suite-de-explore.log` |
| E4 | Course filters: text, destination, degree level, and empty results | Anonymous / returning student | all 4, q=Design 2, country=Germany 2, masters 2, nonsense 0 with empty-state message. Note P2: ?destination=DE (used by the 'Explore a launch country' chips) lists 4 courses, i.e. does not filter the list | **PASS** | `suite-de-explore.log` |
| E5 | Course detail: unverified course labelled; verified course shows last verified | Anonymous / returning student | needs-review course labelled; verified course shows 'Last verified' | **PASS** | `suite-de-explore.log` |
| E6 | Course comparison works for two courses | Anonymous / returning student | two courses compared on /courses/compare | **PASS** | `suite-de-explore.log` |
| E7 | Saving a course appears in Saved | Anonymous / returning student | 1 saved row; listed on /saved | **PASS** | `suite-de-explore.log` |
| E8 | Abroad studio and applications: empty states without errors | Anonymous / returning student | studio and 'No Abroad applications yet' render. Live application tasks (NW06/NW07) not exercised: deferred | **PASS** | `suite-de-explore.log` |
| E9 | Application detail for a non-existent application is handled | Anonymous / returning student | status 200 | **PASS** | `suite-de-explore.log` |
| E10 | Course list when the database is unreachable shows a calm error, not a crash | Anonymous / returning student | status 200: "COURSE EXPLORER Browse courses Search and filter a starter dataset of university courses — subject, qualification level," | **PASS** | `suite-de-explore.log` |
| F1-desktop | Public free-session page renders and leads to the request form (desktop) | Anonymous | 200, no overflow, axe clean, no confirmed-slot wording | **PASS** | `suite-f-discovery.log` |
| F1-mobile | Public free-session page renders and leads to the request form (mobile) | Anonymous | 200, no overflow, axe clean, no confirmed-slot wording | **PASS** | `suite-f-discovery.log` |
| F1-narrow | Public free-session page renders and leads to the request form (narrow) | Anonymous | 200, no overflow, axe clean, no confirmed-slot wording | **PASS** | `suite-f-discovery.log` |
| F2 | Signed-out visitor is sent to log in and returned to the request form | Anonymous → student | /discovery-session/book -> /login?next=… -> back to the form after login | **PASS** | `suite-f-discovery.log` |
| F3 | Request form: contact method, time of day and language; honest success message | Student; admin; assigned counsellor | row saved as 'requested' (whatsapp/evening/Odia, no time); copy says it is a request, not a booked slot, and that no notifications are sent | **PASS** | `suite-f-discovery.log` |
| F4 | Duplicate request: page shows the existing request instead of a second form | Student; admin; assigned counsellor | "You already have a Discovery Session requested A counsellor will reach out to confirm a time that works for you." | **PASS** | `suite-f-discovery.log` |
| F5 | Duplicate request via the server action directly is refused (one active request per student) | Student; admin; assigned counsellor | replayed action -> 'You already have a Discovery Session request in progress'; still 1 row | **PASS** | `suite-f-discovery.log` |
| F6 | Dashboard shows the request as requested, with no time yet | Student; admin; assigned counsellor | "Discovery Session Requested Career Guidance Session View Session Details" | **PASS** | `suite-f-discovery.log` |
| F7 | Server rejects an invalid contact method sent directly to the action | Student; admin; assigned counsellor | no row stored; generic error returned (database check constraint enforces the value) | **PASS** | `suite-f-discovery.log` |
| F8 | Very long free-text fields sent directly to the action | Student; admin; assigned counsellor | rejected — *Fixed in CC-24 (D02): stored 20,000 chars at a1017b9.* | **PASS** | `suite-f-discovery.log` |
| F9 | Admin schedules 20 Nov 2026 18:30 IST from a New York browser; stored as 13:00 UTC | Administrator | stored 2026-11-20 13:00 scheduled UTC; form re-shows 2026-11-20T18:30 (IST) in a New York browser | **PASS** | `suite-f-discovery.log` |
| F10 | Student sees the scheduled time in IST (browser in Berlin) | Returning student | "Discovery Session Scheduled Career Guidance Session Fri, 20 Nov, 6:30 pm IST View Session Details" | **PASS** | `suite-f-discovery.log` |
| F11 | Assigned counsellor sees the session in their list | Assigned counsellor | P1: the assigned session is listed but shows 'Student details restricted' (CC-24 honest label) and no contact details. profiles RLS lets a counsellor read a student only via the admin_student_meta caseload, not via an assigned Discovery Session. Fix: proposed migration 0023 (awaiting approval; verified locally in suite R). Interim: an admin adds the student to the counsellor's caseload — *Access fix = migration 0023 (approval). Verified locally in R6–R8.* | **BLOCKED** | `suite-f-discovery.log` |
| G1-desktop | Pricing shows ₹1,999 tax-inclusive and no checkout links (desktop) | Anonymous / returning student | ₹1,999, tax included, 0 checkout links, free-session CTA present | **PASS** | `suite-g-pricing.log` |
| G1-mobile | Pricing shows ₹1,999 tax-inclusive and no checkout links (mobile) | Anonymous / returning student | ₹1,999, tax included, 0 checkout links, free-session CTA present | **PASS** | `suite-g-pricing.log` |
| G1-narrow | Pricing shows ₹1,999 tax-inclusive and no checkout links (narrow) | Anonymous / returning student | ₹1,999, tax included, 0 checkout links, free-session CTA present | **PASS** | `suite-g-pricing.log` |
| G2 | Direct visit to /pricing/checkout/nextwise-verified offers no way to pay | Anonymous / returning student | no confirm/pay control; price and Discovery Session link shown | **PASS** | `suite-g-pricing.log` |
| G3 | confirmPricingPurchaseAction called directly is refused (Verified, free Explore, invalid id) | Anonymous / returning student | 4 direct calls refused with the 'paused' message; invoices/purchases/attempts/transactions unchanged (6/0/0/0) | **PASS** | `suite-g-pricing.log` |
| G4 | createCheckoutSessionAction called directly for an open invoice creates no payment attempt | Anonymous / returning student | refused; no payment attempt (no Razorpay order can be created) | **PASS** | `suite-g-pricing.log` |
| G5 | Forged payment verification is rejected and changes nothing | Anonymous / returning student | verification failed; invoice still issued/unpaid; no transaction rows | **PASS** | `suite-g-pricing.log` |
| G6 | The existing invoice is shown honestly and not altered or deleted | Anonymous / returning student | invoice listed with its amount; no pay control; row unchanged | **PASS** | `suite-g-pricing.log` |
| G7 | No purchase RPC or payment write reached the database during G1-G6 | Anonymous / returning student | gateway log: 0 purchase/payment writes (the forged G5 verification reached verify_checkout_payment 0x and was rejected by its HMAC/attempt checks) | **PASS** | `suite-g-pricing.log` |
| G8 | Free Discovery Session is still bookable from pricing | Anonymous / returning student | pricing CTA -> /discovery-session/book | **PASS** | `suite-g-pricing.log` |
| H1-desktop-out | 26 public routes at desktop: status, overflow, axe, console | Anonymous and signed-in student | 26 routes clean | **PASS** | `suite-h-sweep.log` |
| H1-desktop-in | 14 signed-in routes at desktop: status, overflow, axe, console | Anonymous and signed-in student | 14 routes clean | **PASS** | `suite-h-sweep.log` |
| H1-mobile-out | 26 public routes at mobile: status, overflow, axe, console | Anonymous and signed-in student | 26 routes clean | **PASS** | `suite-h-sweep.log` |
| H1-mobile-in | 14 signed-in routes at mobile: status, overflow, axe, console | Anonymous and signed-in student | 14 routes clean | **PASS** | `suite-h-sweep.log` |
| H1-narrow-out | 26 public routes at narrow: status, overflow, axe, console | Anonymous and signed-in student | 26 routes clean | **PASS** | `suite-h-sweep.log` |
| H1-narrow-in | 14 signed-in routes at narrow: status, overflow, axe, console | Anonymous and signed-in student | 14 routes clean | **PASS** | `suite-h-sweep.log` |
| H2 | Unknown URL returns a branded 404 with a way back | Anonymous and signed-in student | 404 with Nextwise branding and a home link | **PASS** | `suite-h-sweep.log` |
| H3 | No broken internal links on student-facing pages (signed in) | Anonymous and signed-in student | 113 distinct internal links, none 4xx/5xx | **PASS** | `suite-h-sweep.log` |
| H4 | Mobile menu opens, traps nothing it shouldn't, closes with Escape and returns focus | Anonymous and signed-in student | opened (aria-expanded=true); Escape closed it and focus returned to "Open menu" | **PASS** | `suite-h-sweep.log` |
| H5 | Keyboard focus is visible on links and buttons | Anonymous and signed-in student | 12 consecutive tab stops all show an outline or ring | **PASS** | `suite-h-sweep.log` |
| H6 | Touch targets on the main student pages (390 px): controls smaller than 24×24 px | Anonymous and signed-in student | P2: /: a "DAAD — daad.de ↗ (opens " 91x13; a "Study in NL — studyinnl." 138x13; a "Create a Free Account →" 145x16; a "Privacy" 32x12 (+2) \| /register: input "checkbox" 20x20; a "Terms" 40x18; a "Privacy Policy" 92x18; a "Book free counselling" 145x18 (+1) \| /login: a "Forgot password?" 122x18; a "Register" 56x18 \| /pricing: button "View all services (7)" 130x20; button "View all services (9)" 130x20; button "View all services (12)" 136x20; button "View all services (16)" 136x20 (+3) \| /courses: input "checkbox" 16x16; a "Clear filters" 76x20; a "Fictional Northbridge Un" 308x20; a "View cours — *Show-password now 32×32 (D08). Remaining: checkbox (label is the target) and inline/footer links (inline exception) — see CC24-01 D16.* | **FAIL** | `suite-h-sweep.log` |
| H7 | Session ended elsewhere: the next save explains it, and navigation asks to log in again | Anonymous and signed-in student | save: "Your session has ended, so this step wasn't saved. Log in again to continue — steps you already saved are kept. Log in a"; /dashboard -> /login?next=/dashboard | **PASS** | `suite-h-sweep.log` |
| R1 | Anonymous visitor: dashboard, counsellor and admin areas redirect to login | Anonymous | /dashboard:307 /counsellor:307 /counsellor/discovery-sessions:307 /admin:307 /admin/discovery-sessions:307 /profile:307 — *Fixed in CC-24 (D05): /counsellor was 200 for anonymous at a1017b9.* | **PASS** | `suite-r-roles.log` |
| R2 | Student: counsellor and admin areas are refused; no other student's data | Returning student | admin: Access denied; counsellor session URL shows no identity (14 other students' sessions exist in the database) | **PASS** | `suite-r-roles.log` |
| R3 | Assigned counsellor (today's policies): session listed; identity labelled 'restricted', never 'Unnamed' | Assigned counsellor | list and detail say 'Student details restricted'; detail says to ask an admin — *New in CC-24 (D07 label).* | **PASS** | `suite-r-roles.log` |
| R4 | Unassigned counsellor: cannot see another counsellor's session; open requests show no identity | Unassigned counsellor | assigned session hidden (direct URL status 404); open request listed without name | **PASS** | `suite-r-roles.log` |
| R5 | Admin: sees both students' identities (unchanged) | Administrator | admin list shows 'Fictional R-Target 1794417442190' and 'Fictional Open Request' | **PASS** | `suite-r-roles.log` |
| R6 | [LOCAL, proposed 0023] Assigned counsellor sees the student's name and email; open request still hidden | Assigned counsellor | 'Fictional R-Target 1794417442190' and email shown for the assigned session only | **PASS** | `suite-r-roles.log` |
| R7 | [LOCAL, proposed 0023] Unassigned counsellor still cannot see the student | Unassigned counsellor | no identity on the direct URL | **PASS** | `suite-r-roles.log` |
| R8 | [LOCAL, proposed 0023] Reassignment moves access: B gains it, A loses it | Assigned → reassigned counsellors | B sees the student; A no longer does | **PASS** | `suite-r-roles.log` |
| R9 | Local database returned to today's schema (0023 rolled back) | — | 0 (cc24) policies on profiles | **PASS** | `suite-r-roles.log` |
| V1-desktop | Homepage loads with no console errors (desktop) | Anonymous visitor | 200, 0 console errors, logo present, page height 11403px | **PASS** | `suite-v-homepage.log` |
| V2-desktop | Homepage DOM identical to the deployed a1017b9 build (desktop) | Anonymous visitor | 73702 chars of rendered DOM identical; height 11403px; 28 internal links identical | **PASS** | `suite-v-homepage.log` |
| V3-desktop | Scroll chapters pixel-identical at 8 positions, motion paused (desktop) | Anonymous visitor | 8/8 frames match; anti-aliasing noise only: desktop-cc24-60 3px (max delta 1/255) | **PASS** | `suite-v-homepage.log` |
| V1-mobile | Homepage loads with no console errors (mobile) | Anonymous visitor | 200, 0 console errors, logo present, page height 9557px | **PASS** | `suite-v-homepage.log` |
| V2-mobile | Homepage DOM identical to the deployed a1017b9 build (mobile) | Anonymous visitor | 73598 chars of rendered DOM identical; height 9557px; 28 internal links identical | **PASS** | `suite-v-homepage.log` |
| V3-mobile | Scroll chapters pixel-identical at 8 positions, motion paused (mobile) | Anonymous visitor | 8/8 frames pixel-identical | **PASS** | `suite-v-homepage.log` |

## 3. Not tested / blocked outside the browser run

| Scenario | Status | Why |
|---|---|---|
| Real email delivery (QA SMTP), QA Site URL and redirect allow-list | **BLOCKED** | Remote QA configuration; local GoTrue + mail catcher only (B4, B9) |
| Recommendation reports with data | **BLOCKED** | Needs proposed NW07 `get_my_recommendation_reports` (D8 shows the honest unavailable state) |
| Live application tasks (Abroad) | **BLOCKED** | Needs proposed NW06/NW07 |
| Assigned counsellor sees student identity on QA | **BLOCKED** | Needs migration 0023 (approval); verified locally (R6–R8) |
| Real payments, GST charge in Razorpay test mode | NOT TESTED | Payments must stay off until CC-19/CC-20 (CC24-05) |
| Live AI | NOT TESTED | Disabled by design |
| Document upload, agreements and e-signature, parent flows, Odia toggle | NOT TESTED | Outside CC-24's journey scope |
| Safari/iOS, Firefox, real Android/iOS devices, VoiceOver/TalkBack/NVDA | NOT TESTED | Needs real devices |
| Vercel Preview with QA variables | NOT TESTED | No deployment authorized |

## 4. Automated (non-browser) checks

| Check | Result |
|---|---|
| Vitest | 175 files, **3,045 passed, 1 skipped** (baseline 168 / 2,906 / 1) |
| New regression tests on the unmodified a1017b9 | 6 main files: 28 failures; middleware test: 4 failures (they detect the defects) |
| TypeScript `tsc --noEmit` | PASS (exit 0) |
| ESLint | PASS — 0 errors, 18 warnings (same as baseline) |
| `next build` | PASS (exit 0) |
| `git diff --check` | PASS |
| Proposed 0023 SQL tests (local PostgreSQL) | today 13/3 (the defect), with 0023 16/16, no residue |
| Finish/Rollback scripts (simulated worktree, pwsh 7.4) | 8/8 scenarios; PSScriptAnalyzer: 0 PowerShell 5.1 compatibility issues |
