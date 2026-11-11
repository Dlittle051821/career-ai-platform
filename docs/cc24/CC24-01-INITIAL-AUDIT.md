# CC24-01 — Initial audit and defect register

**Milestone:** CC-24, Student Journey Stabilization, Security & Launch Readiness
**Baseline:** `cc23/student-journeys` @ `a1017b9dddf7ad132e4ccb1fb8abb424042c8fe7` ("Integrate V5.4 homepage with secured CC23 platform"). This is the commit deployed to nextwise.world.
**Worktree:** `C:\ClaudeBuilds\CC24-STUDENT-JOURNEYS`, branch `cc24/student-journey-stabilization`

## 1. Baseline verification

| Check | Result |
|---|---|
| Worktree created from the exact commit | **PASS.** `Start-CC24.ps1` on the PC reported HEAD `a1017b9…c7`, a clean working tree and 1,701 tracked files. |
| Isolation | **PASS.** Separate worktree and new branch. `C:\carrier.ai` stays on `preview/nw07-nw09-release` @ `28c8b28`. The CC-23 worktree is untouched. |
| Source used for CC-24 work | A `git archive` of `a1017b9` (tar commit-id verified `a1017b9…c7`), 1,701 files. |
| Relation to CC-23 | `a1017b9` = the CC-23 fixes plus the V5.4 homepage. All 26 CC-23 files are unchanged. Only homepage, brand and test files differ, and `supabase/`, `package*.json` and config are identical. |
| CC-18 security files (45) | Unchanged at baseline, and still unchanged after CC-24. |
| Baseline checks (run in CC-24) | TypeScript exit 0; ESLint 0 errors / 18 warnings; Vitest **168 files, 2,906 passed, 1 skipped**; `next build` exit 0. |
| Supabase environment contract | `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (browser and server), `SUPABASE_SERVICE_ROLE_KEY` (server-only, `src/lib/supabase/service-role.ts`, never used in student or counsellor flows), `NEXT_PUBLIC_APP_URL`. See `.env.example`. |
| Payment and AI contract | Paid checkout needs `NEXTWISE_PAID_CHECKOUT=enabled`, `NEXTWISE_PAID_CHECKOUT_PREREQUISITES=CC19-CC20-APPROVED` and Razorpay keys. AI needs `AI_OPENAI_APPROVED=true` (plus `AI_REAL_STUDENT_DATA_APPROVED` for real student data). Nothing in the repository sets any of them. |
| Credentials in git | `.env.local` is git-ignored. Tracked env-like paths: `.env.example` (placeholders) and **`supabase/.temp/*`** (project ref and pooler URL; see D18). |

## 2. Method

1. **Code review** of every student, counsellor and admin entry point: middleware, Server Actions, API routes, RLS migrations 0001–0022 and the proposed migrations.
2. **Local stack.** A disposable stack runs the repository's own migrations and fictional data: PostgreSQL 16, real GoTrue v2.180.0 and PostgREST v12.2.3, a mail catcher, and a fault-injecting gateway. It is never connected to QA or production.
3. **Browser re-run** of the CC-23 journey suites against `a1017b9`, plus two new suites:
   - **R:** the role and authorization matrix;
   - **V:** V5.4 homepage regression against the deployed build.

## 3. Defect and risk register

Priority:
- **P0:** security, money, or a blocked core journey.
- **P1:** a launch-scope journey is wrong.
- **P2:** usability, accessibility or robustness.
- **P3:** hygiene.

Status values:
- **FIXED:** code-only fix in CC-24, with a regression test.
- **BLOCKED:** needs approval or remote work.
- **OPEN:** documented, not fixed in CC-24.

| ID | Pri | Area | Finding | Evidence | Status |
|---|---|---|---|---|---|
| D01 | **P1** | Counsellor / RLS | An assigned counsellor cannot read the student's identity. `profiles` RLS grants counsellors access only through the `admin_student_meta` caseload. A Discovery Session assignment doesn't create a caseload row, and 0014 widened two other tables on that basis but not `profiles`. | CC-23 F11; `0004` PART 12; `0014` | **BLOCKED.** Migration 0023 is prepared and tested; it needs approval (CC24-03). |
| D02 | **P1** | Discovery Session | The booking Server Action stored arbitrary values sent directly: a 20,000-character note, a 5,000-character language, any time range. | CC-23 F8 | **FIXED** |
| D03 | **P1** | Profile | The profile save Server Actions accepted unbounded free text and unlimited education/experience rows. The DB has no length constraints on these columns. | code review | **FIXED** |
| D04 | **P1** | Discovery | Unknown, draft or unpublished career, university and course URLs answered **HTTP 200** (soft 404). The university and course lists' `loading.tsx` wrapped the detail routes, so even a `notFound()` could not change the status. | CC-23 D3/E3 | **FIXED** |
| D05 | P2 | Auth | `/counsellor` was missing from the middleware's protected paths. A signed-out visitor got HTTP 200 "Access denied — your account is signed in…" and no route to log in. The layout's role gate still refused access, so no data was exposed. | suite R1 (CC-24) | **FIXED** |
| D06 | P2 | Payments | `verifyCheckoutAction` was not behind the payment launch gate. It is harmless (it needs an existing attempt and a valid HMAC), but it was the one payment action without the gate. | code review | **FIXED** |
| D07 | P2 | Counsellor UI | A profile hidden by RLS rendered exactly like an empty name ("Unnamed student"), so a missing permission looked like missing data. | CC-23 F11 | **FIXED** (honest label; access itself is D01) |
| D08 | P2 | A11y | The show/hide password button was a 16×16 px target (WCAG 2.5.8 asks for 24×24). | CC-23 H6 | **FIXED** (32×32) |
| D09 | P2 | Onboarding | The `*` markers implied a hard requirement, but Continue saves partial steps (intended: partial profiles must be saveable). | CC-23 C11 | **FIXED** (legend) |
| D10 | P2 | Discovery | On `/courses` the launch-country chips select the trusted official portal, not the course list. This is by design (pinned by M20C tests), but the UI didn't say so. | CC-23 E4 | **FIXED** (explanatory note) |
| D11 | P3 | Onboarding | The welcome-page path action trusted its `choice` argument at runtime (the DB CHECK would reject a bad value, but the student was still redirected). | code review | **FIXED** |
| D12 | P1 | Dashboard | Recommendation reports need `get_my_recommendation_reports` (proposed NW07, not in 0001–0022). The page already shows an honest "temporarily unavailable". | CC-23 D8; NW07 | **BLOCKED** (NW07 approval) |
| D13 | P1 | Abroad | Live application tasks need proposed NW06/NW07. Only the empty states are verified. | CC-23 E8 | **BLOCKED** |
| D14 | **P0** | Payments | The GST-inclusive Verified price (₹1,999 total) is only guaranteed after the CC-19/CC-20 migrations (NW01 + nw-f01-s3 05/06, prepared in CC-18) are applied and signed off. Until then paid checkout must stay off. | CC-18 | **BLOCKED.** Gate verified closed (CC24-05). |
| D15 | P2 | A11y / brand | 4 brand colour pairs fall below 4.5:1: `text-secondary` 4.38, white on `bg-accent` 2.99, `text-accent-dark` 4.44, primary on tint 4.48. | CC-23 axe | **OPEN.** Brand decision; restriction: no colour changes. |
| D16 | P2 | A11y | The Terms checkbox is 20×20 px. Its whole label is clickable, so the effective target is larger (WCAG 2.5.8's "equivalent" exception). Inline and footer links are exempt as inline targets. | CC-23 H6 | OPEN (documented) |
| D17 | P2 | Performance | The middleware calls `auth.getUser()` on every request, including link prefetches (20–45 Auth calls per page view). | CC-23 | OPEN |
| D18 | P3 | Hygiene | `supabase/.temp/*` is tracked in git: project ref, pooler URL, CLI versions. These aren't secrets, but they are infrastructure identifiers. | start report | OPEN. Needs `git rm --cached` in a reviewed commit. |
| D19 | P2 | Profile | Repeatable sections save as delete + insert from the server. A failure between the two can drop that section; the student sees an error and can retry. | code review | OPEN. Needs an atomic DB function (migration). |
| D20 | P1 | Auth | Real email delivery and the QA Site URL/redirect allow-list are unverified. Locally proven only with GoTrue and a mail catcher. | CC-23 | **BLOCKED** (remote) |
| D21 | P2 | Brand / legal | The public-use rights of the V5.4 student portrait (`public/home-v54/v54-portrait*.png`) are unresolved. | brief | OPEN. Replace with a licensed asset in the next visual update. No design change in CC-24. |
| D22 | P3 | Discovery Session | Students can't cancel or reschedule online. This is by design, and the copy says so; staff manage status. | code review | Documented |
| D23 | P2 | Counsellor | `current_counsellor_id()` doesn't check `counsellors.is_active`. A deactivated counsellor keeps RLS-scoped access until their `admin_roles` row is removed. This is the existing pattern across all counsellor policies. | code review | OPEN (CC24-03 §5) |

**No new P0 code defect was found.**
- The open P0 (D14) is the known GST/payment prerequisite. The launch gate keeps it safe.
- The P0 from CC-23 (form login) is fixed in the baseline and re-verified (B6, B11).

## 4. Areas verified as already correct

- **Payments** stay off whatever credentials are set. No purchase, invoice or order can be created while off (G1–G7).
- **Webhooks** reject unsigned, unconfigured or invalid deliveries (400/503). The DB re-verifies the HMAC.
- **AI** is off unless explicitly approved through two separate flags. No student-facing AI path exists.
- **Duplicate prevention:**
  - a unique index blocks a second active Discovery Session (F4/F5);
  - an in-flight guard blocks double onboarding saves (C15).
- **Open redirects:** `?next` is safe (B12).
- **Account privacy:** registration doesn't reveal whether an account exists (B5).
- **Timezones:** IST scheduling is correct from New York and Berlin (F9/F10).
