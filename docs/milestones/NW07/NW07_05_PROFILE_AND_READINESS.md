# NW07.5 — Profile Verification and Readiness

## 1. Scope

Surfacing, in the Counsellor Studio, the four distinct readiness/verification concepts that exist in this codebase, without conflating any of them:

| Concept | Source | New in NW07? |
|---|---|---|
| Discovery Session completion | `discovery_sessions.status` / workspace sections A–J | No — reused |
| Profile section verification | `student_profile_section_provenance` (Milestone 11-C1) | No — reused via `ProfileProvenanceCard` |
| Recommendation Readiness | `computeRecommendationReadiness()` (Milestone 11-C2) | No — reused via `RecommendationReadinessCard` |
| **Application Readiness** | `getApplicationReadiness()` (Milestone 18) | No — **existed already**, newly surfaced in Counsellor Studio this stage |

`NW07_01_AUDIT.md`'s classification table listed "Application Readiness" as MISSING. On closer reading of `src/lib/applications/application-readiness.ts` while building this stage, that was wrong at the pure-logic level — the function has existed since Milestone 18 and is already used by `/admin/applications/[id]`. What was actually missing, and is what this stage built, is Application Readiness surfaced **inside the Counsellor Studio's own Student Case Workspace** — a counsellor working a case previously had to leave `/counsellor` entirely and go to `/admin/applications/[id]` to see it.

## 2. What was built

- **Verifications queue** (`src/app/counsellor/verifications/page.tsx`) — the cross-case "who needs a first verification" list the dashboard tile and nav link to. Reuses `getCounsellorDashboardData()`'s own `computePendingVerificationFlags()` output rather than a second query, restated as its own full page instead of a 6-row dashboard preview. States the `CASELOAD_SCAN_LIMIT` bound explicitly when a caseload exceeds it (see `NW07_02_COUNSELLOR_DASHBOARD.md` §3) — never presents a partial scan as if it were exhaustive.
- **Application Readiness in the Student Case Workspace** — `src/app/counsellor/students/[studentId]/page.tsx`'s Applications table gained a "Readiness" column. For each application in `READINESS_APPROPRIATE_STAGES` (`inquiry`/`preparing`/`ready_to_submit`), it computes `getApplicationReadiness()` from the application's own current documents (`listApplicationDocumentsForAdminBatch()`) and manual checklist state (`getApplicationChecklistItemsBatch()`) — the exact same pure function and the exact same batched reads `/admin/applications/[id]` and the UX09 batch helpers already provide, not a second computation. An application past that stage shows "Already past preparation" rather than a stale or meaningless readiness claim.

## 3. Permission gating

The readiness column is gated on **both** `application-documents:read` and `application-documents:review` (the two permissions the underlying batch reads already require) — a role holding neither, or only one, never sees a readiness claim the page can't actually back with real document/checklist data. Both permissions are held by `counsellor` and `admin`/`super_admin`; `finance`/`content_editor`/`analyst` see neither the column's data nor an inaccurate placeholder.

## 4. Deliberate non-goals

This stage adds no new table, no new RPC, and no new pure-logic module for readiness — every signal it surfaces already existed. It does not attempt to unify the four concepts above into one combined "case readiness score"; the brief's own spec for Recommendation Readiness (Milestone 11-C2) is explicit that readiness concepts answer different questions and must not be reconciled into one number.

## 5. Verification

`npx tsc --noEmit` and `npx eslint` clean. `npx vitest run` — 139 files / 2309 tests passing, including the pre-existing `application-readiness.test.ts` (unchanged) that already covers `getApplicationReadiness()`'s own logic.
