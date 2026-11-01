# NW08.5.6 — Information, Auth & Legal Pages

Per-page findings for this group are detailed in
`NW085_01_PUBLIC_PAGE_AUDIT.md` §3; this document summarizes the group's
compliance against the brief's specific per-page instructions and lists
what was fixed.

## 1. How It Works
Brief asks for a visual timeline, both journeys represented without
forcing either. Already rebuilt (UX10-HW01) around a 5-step journey flow
(`JourneyStepFlow`) plus a dual-pathway section (`StudyPathwaysSection`)
that presents Career Intelligence and Nextwise Abroad side by side.
**Compliant, unchanged.**

## 2. Pricing
Brief requires preserving the real pricing/entitlement rules exactly,
including the exact "Nextwise Verified is INR 1,999 inclusive of
applicable GST" framing, with checkout left inactive and the known
financial-safety issue restated, not resolved. `listPublicPricingPlans()`
is the single real data source (no hardcoded price anywhere on this
page); checkout code was not touched by this milestone. The known GST
issue is documented in full in `NW085_01_PUBLIC_PAGE_AUDIT.md` §6.
**Compliant, unchanged.**

## 3. About
Brief requires professional storytelling reflecting the actual mission,
no fabricated founder credentials/partnerships, and to preserve the
decision to focus early marketing on the brand rather than a founder
reveal. **Fixed this milestone:** the page's own "what's live today"
disclosure had gone stale (still said "Milestone 1 build... frontend-only
interactions," understating how much of the site now genuinely works).
Updated to state the real current functional boundary honestly — real
accounts/applications/payments/counselling vs. the one thing still not
live, a student-facing AI recommendation engine. The "no founder bios"
stance and the Odisha-first, brand-not-founder positioning were already
in place and are unchanged.

## 4. Book Counselling
Brief requires an honest explanation of the Discovery Session offering,
no promised unavailable appointment times. Already rebuilt in UX10-DS02
specifically to replace an earlier version whose own success screen
admitted the booking "was not transmitted, booked, or stored anywhere" —
this page is now an honest landing that sends a visitor to the real,
database-backed booking flow at `/discovery-session/book` rather than
running a fake form of its own. **Compliant, unchanged.**

## 5. Trust Center
Brief requires distinguishing confirmed vs. pending-verification
information. Already built around `TrustBadge`/`ComingSoon`/`DemoNotice`
components whose entire purpose is exactly that distinction (verification
status, payment protection, refund/escalation processes, a stated
"no-guarantees" policy). **Compliant, unchanged.**

## 6. Contact
Brief requires never inventing a business email address, and removing or
replacing a placeholder like `hello@nextwise.example`. **Fixed this
milestone:** that exact placeholder (an RFC 2606 reserved, non-routable
"example" domain) was removed from `CONTACT.emailLabel` in
`src/config/site.ts` and replaced with an honest "Email support — coming
soon," the same treatment already used on the same page for phone support
and the physical office. No real, approved email address has been
supplied to put in its place, so none was invented. The regression test
that previously pinned the old placeholder marker
(`src/config/site.test.ts`) was updated to assert the stricter, still-valid
invariant — the label must never contain an `@` (i.e. never look like a
real address) — rather than deleted.

## 7. Parents
No specific brief instruction beyond general accuracy; already covers
cost planning, fraud warning signs, and family-participation guidance
with no invented figures. **Compliant, unchanged.**

## 8. Auth (Login / Register / Forgot Password / Reset Password)
Brief requires polishing the flow while keeping the existing Supabase
auth and never introducing a second auth system. All four pages already
use the one real `AuthLayout`/`LoginForm`/`RegisterForm` components, the
shared `getSafeRedirectPath()` validator (no bare, unvalidated `next`
redirect), and each independently carries its own permanent
`robots: { index: false, follow: false }`. **Compliant, unchanged.**

## 9. Welcome
Independently noindexed and redirect-protected; its own "LOCKED
requirement: never a mandatory long profile form" is honored.
**Compliant, unchanged.**

## 10. Verification
`npx tsc --noEmit` clean, `npx eslint` clean on every file touched (About,
`site.ts`, `site.test.ts`), `npx vitest run src/config/site.test.ts`
passing (42/42, including the rewritten email-placeholder assertion).
Full aggregate regression is reported once in `NW085_09_QA_REPORT.md`.
