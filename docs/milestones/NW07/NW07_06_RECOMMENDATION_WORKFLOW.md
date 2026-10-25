# NW07.6 — Professional Recommendation Workflow

## 1. Scope

The user's requirement #2 in full: "Counsellors prepare guidance, authorised reviewers approve it, and students receive only released reports." Confirmed via `grep` during NW07.1's audit that **no** prior recommendation-authoring/approval/release system existed anywhere in this codebase — this is genuinely new, not an extension of an existing table.

## 2. The state machine

`recommendation_drafts.status`: `draft → submitted_for_review → changes_requested → (back to draft/submitted_for_review) → approved → released_to_student → archived`. The fixed transition table is enforced in exactly one authoritative place — the chain of `staff_*` RPCs in `supabase/migrations-proposed/NW07_counsellor_studio_foundation.sql` PART 2 — and restated in pure TypeScript (`getAllowedRecommendationDraftActions()`, `src/lib/recommendations/drafts.ts`) **only** as a UI convenience, so an impossible action button is never rendered. The TS copy is never trusted as the security boundary; every RPC re-checks its own transition regardless of what the UI showed.

## 3. Self-approval prevention — the one rule that is never UI-only

`staff_review_recommendation_draft()` raises if the calling reviewer is the draft's own author (`created_by = auth.uid()`), checked **before** the role-authorization branch and with **no role-based exception** — an admin cannot approve their own draft either. `canReviewOwnDraft(authorUserId, reviewerUserId)` in `src/lib/recommendations/drafts.ts` restates this in TypeScript only to disable the Approve/Request-changes buttons before a doomed click (a friendlier failure), never as a substitute for the database check. The Recommendation Review page (`/counsellor/recommendations/[id]`) shows an explicit "you authored this report, so you can't review it yourself" message in place of the two buttons when this applies.

## 4. Approval-before-release — two independent enforcements

1. A CHECK constraint on `recommendation_drafts.status`'s own transition path.
2. `staff_release_recommendation_draft()`'s own re-check that the draft is currently `approved` before writing `released_to_student`.

Neither alone is trusted as sufficient; both must agree for a release to succeed.

## 5. Immutable version history

`recommendation_draft_versions` is **append-only** — every content edit (`staff_update_recommendation_draft_content()`) inserts a new version row and advances `recommendation_drafts.current_version_id`; nothing ever `UPDATE`s an existing version row. `listRecommendationDraftVersions()` exposes the full history, oldest first, as the audit trail the brief requires.

## 6. RPC-only writes, zero plain write RLS

`recommendation_drafts`/`recommendation_draft_versions` each have exactly one SELECT policy (staff-only, scoped by the same `counsellor_has_case_access()` dual-basis check as every other case table) and **zero** write policy for any role — matching the `application_tasks`/`application_documents` pattern already established in Milestones 17–19. Every mutation is one of 9 `SECURITY DEFINER` RPCs: `staff_create_recommendation_draft`, `staff_update_recommendation_draft_content`, `staff_submit_recommendation_draft_for_review`, `staff_review_recommendation_draft`, `staff_release_recommendation_draft`, `staff_withdraw_recommendation_draft`, `staff_archive_recommendation_draft`, `get_my_recommendation_reports`, `get_my_recommendation_report_content`. All revoked from `public`, granted only to `authenticated`.

## 7. Student access — structurally safe, not merely filtered

A student never reads `recommendation_drafts`/`recommendation_draft_versions` directly — there is no student RLS policy on either table at all. The **entire** student-facing surface is the two `get_my_*` RPCs, whose `RETURNS TABLE` shapes structurally exclude every internal column (`review_notes`, `created_by`, `reviewed_by`, `approved_by`, `released_by`, `archived_by`, `submitted_by`, `author_counsellor_id`) — not a `SELECT *` filtered after the fact that a future column addition could silently leak through. `get_my_recommendation_reports()` and `get_my_recommendation_report_content()` return rows **only** for the caller's own, currently-`released_to_student` drafts; a draft, submitted, changes-requested, or approved-but-unreleased report is invisible to the student by construction, not by a status check a page could forget.

## 8. What was built — data access and UI

- `src/lib/recommendations/drafts.ts` — pure taxonomy/state-machine helpers (statuses, types, allowed actions, editability, self-review check, content shape, dashboard tally). 16 tests in `drafts.test.ts`.
- `src/lib/supabase/admin/recommendation-drafts.ts` — staff I/O: list/get/create/update-content/submit/review/release/withdraw/archive, plus the `*WithStudentNames` conveniences the list and detail pages need for display.
- `src/lib/supabase/education/recommendation-reports.ts` — student-facing read-only I/O (two functions, §7 above). Returns `[]`/`null` rather than throwing for a logged-out caller, a non-existent draft, or an RPC error — never distinguishing "not yours" from "doesn't exist" from "not released yet" (anti-enumeration, matching the RPC's own documented behaviour).
- `src/components/counsellor/NewRecommendationDraftForm.tsx` — starts a new draft from the Student Case Workspace.
- `src/components/counsellor/RecommendationDraftActionForms.tsx` — every action button on the Recommendation Review page (edit content, submit for review, approve, request changes, release, withdraw, archive).
- `src/app/counsellor/recommendations/page.tsx` — the cross-case queue (every draft the viewer's RLS grants them, via `listMyRecommendationDraftsWithStudentNames()`).
- `src/app/counsellor/recommendations/[id]/page.tsx` + `actions.ts` — the Recommendation Review page: content editor (only while editable), and every state-transition action, each rendered only when `getAllowedRecommendationDraftActions()` currently allows it.
- `src/app/studio/recommendation-reports/page.tsx` + `[id]/page.tsx` — the student-facing release surface, at a route deliberately distinct from the existing `/recommendations` page (the AI/engine-based career-matches surface — a different concept this feature must never be conflated with). Linked from the `/studio` hub only once the student has at least one released report, to avoid an empty-state tile for every student who has none.

## 9. NW09 boundary (forward-looking, not built here)

The brief's third paragraph: "Later, NW09's AI functionality should operate inside this controlled process — not bypass it." Nothing in NW07 wires an AI/LLM call into this workflow. The design decision that makes that safe later: `staff_create_recommendation_draft()`/`staff_update_recommendation_draft_content()` accept arbitrary `p_content` from **any** authorized caller — a future NW09 integration would call the identical RPC a human counsellor calls today (as a suggested first draft, never an auto-approved or auto-released one), and would still be blocked by the unconditional self-approval-prevention and approval-before-release checks in §3–4. No separate "AI bypass" code path exists to close off, because none was opened.

## 10. Verification

`npx tsc --noEmit`, `npx eslint`, `npx vitest run` (139 files / 2309 tests) all clean. Migration-security coverage: `src/lib/recommendations/recommendation-drafts-migration-security.test.ts` (static-SQL-text audit) — see `NW07_08_QA_REPORT.md` §2 for what it specifically asserts and why it lives under `src/lib/recommendations/` rather than `src/lib/supabase/admin/` (the `vitest.config.mts` include-allowlist issue).
