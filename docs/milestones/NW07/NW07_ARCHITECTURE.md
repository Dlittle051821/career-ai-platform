# NW07 Architecture — Counsellor Studio Foundation

## 1. Summary

NW07 adds a new, distinctly-branded route tree (`/counsellor/**`) that reuses the exact same `src/lib/supabase/admin/*.ts` data-access functions `/admin/**` already uses — not a second backend, not a second auth system (`NW07_01_AUDIT.md` §5's routing decision). It fixes a pre-existing RLS gap (§6) that silently blocked a Discovery-Session-only counsellor from reading a student's actual profile data, and adds one genuinely new subsystem — the Recommendation Workflow (`recommendation_drafts`/`recommendation_draft_versions` + 9 RPCs) — implementing the user's requirement #2 end to end.

## 2. New files

**Routes (`src/app/counsellor/**`, `src/app/studio/recommendation-reports/**`):**
`layout.tsx`, `page.tsx` (dashboard), `students/page.tsx`, `students/[studentId]/page.tsx`, `students/actions.ts`, `discovery-sessions/page.tsx`, `discovery-sessions/actions.ts`, `discovery-sessions/[id]/page.tsx`, `discovery-sessions/[id]/workspace/page.tsx`, `discovery-sessions/[id]/workspace/actions.ts`, `verifications/page.tsx`, `recommendations/page.tsx`, `recommendations/[id]/page.tsx`, `recommendations/[id]/actions.ts`, `tasks/page.tsx`, `settings/page.tsx`; `studio/recommendation-reports/page.tsx`, `studio/recommendation-reports/[id]/page.tsx`.

**Components:** `src/components/counsellor/CounsellorShell.tsx`, `NewRecommendationDraftForm.tsx`, `RecommendationDraftActionForms.tsx`.

**Pure logic:** `src/lib/recommendations/drafts.ts` (+ `drafts.test.ts`, `recommendation-drafts-migration-security.test.ts`).

**Data access:** `src/lib/supabase/admin/counsellor-dashboard.ts`, `src/lib/supabase/admin/recommendation-drafts.ts`, `src/lib/supabase/education/recommendation-reports.ts`.

**Database (proposed, unapplied):** `supabase/migrations-proposed/NW07_counsellor_studio_foundation.sql`.

**Docs:** this file, `NW07_01_AUDIT.md` through `NW07_08_QA_REPORT.md`, `NW07_DATABASE_CHANGE_PLAN.md`, `NW07_SECURITY_THREAT_MODEL.md`, `NW07_COMPLETION_REPORT.md`, `NW07_INSTALL_GUIDE.md` (all under `docs/milestones/NW07/`).

## 3. Modified files

- `src/types/database.ts` — added `RecommendationDraftsRow`/`RecommendationDraftVersionsRow` types, 10 new `Functions` entries, and the two new `Tables` entries.
- `src/lib/admin/permissions.ts` — added `counsellor-studio:read` (gates the whole `/counsellor/**` layout; granted to `admin`+`counsellor`, withheld from `finance`/`content_editor`/`analyst`) and `recommendation-drafts:read`/`write` (granted to `admin`+`counsellor`).
- `src/lib/supabase/admin/audit.ts` — added `"recommendation_draft"` to `AUDIT_ENTITY_TYPES`.
- `src/lib/supabase/admin/application-tasks.ts` — added `listMyOpenStaffApplicationTasks()` (NW07.7).
- `src/lib/supabase/admin/discovery-sessions.ts` — added `studentUserId?: string` to `DiscoverySessionFilters` (NW07.3).
- `src/app/studio/page.tsx` — added a conditional "Recommendation Reports" tile, shown only once the student has at least one released report.

## 4. Data flow

**Case access:** every `/counsellor/**` read goes through `createClient()` (anon key + session cookies — genuinely RLS-evaluated as the signed-in user, never a service-role bypass) calling the identical `src/lib/supabase/admin/*.ts` functions `/admin/**` calls. The only thing that changed to make a counsellor's own cases visible through those same functions is the RLS widening in migration PART 1 (§5 below) — no application-layer filter was added anywhere.

**Recommendation Workflow:** `staff_create_recommendation_draft` → draft (status `draft`) → `staff_update_recommendation_draft_content` (new version each edit) → `staff_submit_recommendation_draft_for_review` → `staff_review_recommendation_draft` (approve → `approved`, or request_changes → `changes_requested`, looping back to editing) → `staff_release_recommendation_draft` (only from `approved`) → `released_to_student`, at which point `get_my_recommendation_reports()`/`get_my_recommendation_report_content()` begin returning it to the student, and nowhere else. `staff_withdraw_recommendation_draft`/`staff_archive_recommendation_draft` are the two off-ramps.

## 5. Dependency graph (new/changed only)

```
NW07_counsellor_studio_foundation.sql (PART 1: RLS widening, PART 2: recommendation_drafts/versions + 9 RPCs)
  └─ src/lib/supabase/admin/recommendation-drafts.ts ─┬─ src/app/counsellor/recommendations/**
                                                       └─ src/app/counsellor/students/[studentId]/page.tsx
  └─ src/lib/supabase/education/recommendation-reports.ts ─ src/app/studio/recommendation-reports/**
  └─ (RLS widening alone) ─ every existing admin/*.ts function, reused unchanged by /counsellor/**

src/lib/recommendations/drafts.ts (pure)
  └─ src/lib/supabase/admin/recommendation-drafts.ts
  └─ src/app/counsellor/recommendations/[id]/page.tsx (getAllowedRecommendationDraftActions/canReviewOwnDraft)
  └─ src/components/counsellor/RecommendationDraftActionForms.tsx

src/lib/supabase/admin/counsellor-dashboard.ts
  └─ listStudents / listDiscoverySessions / getSectionProvenanceMap / listMyRecommendationDrafts / listMyOpenStaffApplicationTasks (all pre-existing)
  └─ src/app/counsellor/page.tsx, src/app/counsellor/verifications/page.tsx

src/components/counsellor/CounsellorShell.tsx
  └─ every src/app/counsellor/** page (via src/app/counsellor/layout.tsx)
```

## 6. Architectural decisions and why

- **New route tree, not a modified `/admin`:** per `NW07_01_AUDIT.md` §5 — a counsellor needs a distinct, focused nav (no Universities/Pricing/Billing Settings/Education Imports), and `/admin/**` continues to serve finance/content_editor/analyst/super_admin unchanged.
- **Fix the RLS gap at the policy level, not with an application-layer workaround:** the single-basis-only gap (`NW07_01_AUDIT.md` §3, fixed by migration PART 1 — see `NW07_DATABASE_CHANGE_PLAN.md`) could have been "fixed" by adding a second lookup in each `admin/*.ts` function instead. That was rejected — it would have meant re-deriving case access in a dozen places instead of one `counsellor_has_case_access()` helper function reused by both RLS and every new RPC, and it would have left the direct-query path (if anything ever bypassed the helper functions) still vulnerable.
- **RPC-only writes for the Recommendation Workflow, zero plain write RLS:** matches the established `application_tasks`/`application_documents` pattern (Milestones 17–19) rather than inventing a new access-control shape for one more table family.
- **Structurally safe `RETURNS TABLE`, not a filtered `SELECT *`:** a future column added to `recommendation_drafts` (e.g. a new internal field) cannot silently leak to a student through the two `get_my_*` RPCs, because their column lists are fixed and explicit.

## 7. What NW07 explicitly did not touch

`/admin/**` (every file, unchanged — zero behavior change for existing admin/finance/content_editor/analyst users). The Application Workflow / Secure Document Centre / Application Tasks system (Milestones 16–19) — reused read-only via the new Application Readiness surfacing (`NW07_05_PROFILE_AND_READINESS.md`), never modified. Pricing, billing settings, refunds, agreements, electronic stamping — no file under any of those modules was touched. No AI/LLM integration — NW09's eventual integration point is designed for (§9 of `NW07_06_RECOMMENDATION_WORKFLOW.md`) but nothing resembling it is built here.
