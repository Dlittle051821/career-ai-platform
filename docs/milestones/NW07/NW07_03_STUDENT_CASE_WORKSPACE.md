# NW07.3 — Student Case Workspace

## 1. Scope

`/counsellor/students` (My Caseload list) and `/counsellor/students/[studentId]` (the Student Case Workspace) — the user's requirement #1: "one student case, not several disconnected records." The workspace reuses the same student profile, Discovery Session records, saved universities, and application information `/studio` and `/admin/students/[id]` already expose — no second student data model.

## 2. What was built

- `src/app/counsellor/students/page.tsx` — "My Caseload", adapted directly from `/admin/students/page.tsx`. Reuses `listStudents()` **unchanged**: after the Part 1 RLS widening (`NW07_DATABASE_CHANGE_PLAN.md`), its own query is already scoped by RLS to exactly a counsellor's dual-basis cases, so this page needs no counsellor-specific filter of its own. An admin visiting the same route still sees every student — this route is a presentation layer, not a second query path.
- `src/app/counsellor/students/[studentId]/page.tsx` — the Student Case Workspace, adapted from `/admin/students/[id]/page.tsx`. Composes: `getStudentDetail()` (profile, applications, notes), `getStudentProfileSnapshotForAdmin()` + `calculateCompletion()` (profile completion), `getSectionProvenanceMap()` + `ProfileProvenanceCard` (profile verification), `getRecommendationReadinessForAdmin()` + `RecommendationReadinessCard` (recommendation readiness), `listDiscoverySessions({ studentUserId })` (the student's own Discovery Session history — new filter, §3), `listRecommendationDraftsForStudent()` + `NewRecommendationDraftForm` (NW07.6, see `NW07_06_RECOMMENDATION_WORKFLOW.md`), and a per-application Application Readiness badge (NW07.5, see `NW07_05_PROFILE_AND_READINESS.md`).
- `src/app/counsellor/students/actions.ts` — Server Action wrappers (`addStudentNoteAction`, `setSectionProvenanceAction`, `setRecommendationVerificationAction`, `clearRecommendationVerificationAction`, `createRecommendationDraftAction`), each calling the identical `src/lib/supabase/admin/*.ts` function `/admin/students/actions.ts` already calls. Only the `revalidatePath()` targets differ.

## 3. One new filter, zero new tables

`DiscoverySessionFilters` gained one optional field, `studentUserId`, used by `listDiscoverySessions()` to scope the query with `.eq("student_user_id", studentUserId)`. RLS still applies on top regardless of this filter — a counsellor only ever sees rows RLS already grants them.

## 4. IDOR / case-ownership protection

Not re-implemented at the application layer. `getStudentDetail()`'s own `profiles` read is RLS-scoped (dual-basis, after Part 1) — a counsellor who edits the URL's `studentId` to a case they don't have access to gets `student === null` here and an honest `notFound()`, never another counsellor's data leaking through a different code path. This is deliberate: the real boundary is the database policy, not a `studentId === assignedCounsellorId` check sprinkled through page code that could be missed on one route and not another.

## 5. Deliberate omission: no reassignment/status-write form

`counsellor` holds no `students:write` permission at all (`src/lib/admin/permissions.ts`). Operational status and counsellor (re)assignment stay admin-only by design — the workspace shows both as plain read-only text, never a form that would fail on submit. See `NW07_01_AUDIT.md` §3 for why `admin_student_meta`'s own UPDATE/INSERT policies were deliberately left untouched by the Part 1 migration.

## 6. Verification

`npx tsc --noEmit` clean. The page's own case-scoping relies on existing, already-tested RLS/data-access functions; no new pure logic was introduced in this stage beyond the one filter field above (covered by the migration-security test's PART 1 assertions, `NW07_08_QA_REPORT.md` §2).
