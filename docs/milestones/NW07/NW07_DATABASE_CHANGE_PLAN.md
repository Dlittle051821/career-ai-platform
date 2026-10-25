# NW07 — Database Change Plan

**Status: PROPOSED, NOT APPLIED.** `supabase/migrations-proposed/NW07_counsellor_studio_foundation.sql` (798 lines) has not been run against any database — this sandbox has no live Supabase project reachable, and no migration in this session has ever been applied to a remote project per the standing hard constraint. A human must review and apply it to a real staging environment before any `/counsellor/**` page can return real data.

## 1. Existing tables/functions reused (zero change)

`profiles`, the 11-table Student Digital Profile family, `admin_student_meta`, `admin_student_notes`, `discovery_sessions`, `discovery_session_workspace`, `student_profile_section_provenance`, `student_recommendation_verifications`, `application_tasks`, `application_documents`, `application_checklist_items`, `counsellors` — every one of these is read through its pre-existing table/RPC, unchanged in shape. The only thing PART 1 below changes about any of them is **who the existing RLS policy admits**, never a column or a write path.

## 2. PART 1 — Counsellor case-access widening

**The gap this fixes** (`NW07_01_AUDIT.md` §3): migration `0014_discovery_session_counsellor_scope.sql` introduced a "dual-basis" counsellor case-access model — a counsellor has access if EITHER they hold a direct `admin_student_meta.assigned_counsellor_id` assignment OR they are the `assigned_counsellor_id` on one of the student's `discovery_sessions`. But 0014 only ever applied that dual-basis OR to **two** tables (`student_profile_section_provenance`, `student_recommendation_verifications`). Re-reading `0004_admin_system.sql` PART 12 in full confirmed `profiles`' own SELECT policy, all 11 Student Digital Profile tables, `admin_student_meta`'s own SELECT policy, and `admin_student_notes` SELECT+INSERT were all **single-basis only** (`admin_student_meta` assignment). Since a counsellor can never self-insert into `admin_student_meta` (INSERT is super_admin/admin-only), a counsellor who had only run a student's Discovery Session had **no way to read that student's actual profile/identity data at all** — a real, pre-existing security/functionality gap this milestone's brief would have otherwise walked straight into.

**The fix:** widens the same 14 policies to the identical dual-basis OR 0014 already established, via the same `foreach`/dynamic-SQL technique 0004 itself used for the 11-table loop. Adds one new reusable helper, `counsellor_has_case_access(p_student_user_id uuid)` (`SECURITY DEFINER`, `STABLE`, locked `search_path`), so the dual-basis check is written once and reused by every new RLS policy and RPC in PART 2, rather than re-derived per policy.

**Deliberately NOT changed:** any INSERT/UPDATE policy on the 11 `student_*` tables (student-only, untouched), or `admin_student_meta`'s own UPDATE policy — status changes and counsellor (re)assignment stay `super_admin`/`admin`-only, exactly as before. A counsellor who only has the discovery-session basis can now **see** the case and act on it via every table/RPC this milestone adds, but cannot grant themselves the stronger, permanent `admin_student_meta` assignment merely by having run one session.

## 3. PART 2 — Recommendation Workflow (genuinely new)

**New tables:**

- `recommendation_drafts` — one row per counsellor-authored report. Columns include `student_user_id`, `recommendation_type` (CHECK: career/course/college/pathway or null), `title`, `status` (CHECK: the six-value lifecycle), `current_version_id`, `created_by`, `author_counsellor_id`, and the full `submitted_*`/`reviewed_*`/`approved_*`/`released_*`/`archived_*` actor+timestamp pairs. Two safety-invariant CHECK constraints: a released draft must carry its release AND approval provenance; an approved-or-released draft must carry its approval provenance. **Zero** insert/update/delete RLS policy for any role, including `super_admin`/`admin` — RPC-only.
- `recommendation_draft_versions` — one immutable row per authored revision. `content jsonb` (CHECK: must be a JSON object), `version_number` (unique per draft, >= 1), `authored_by`. **Zero** insert/update/delete RLS policy for anyone — append-only, RPC-only.

**New RPCs (9, all `SECURITY DEFINER`, locked `search_path`, revoked from `public`, granted to `authenticated`):** `staff_create_recommendation_draft`, `staff_update_recommendation_draft_content`, `staff_submit_recommendation_draft_for_review`, `staff_review_recommendation_draft` (the approval gate — self-approval prevention, see `NW07_SECURITY_THREAT_MODEL.md` §2), `staff_release_recommendation_draft` (approved-only), `staff_withdraw_recommendation_draft`, `staff_archive_recommendation_draft`, `get_my_recommendation_reports`, `get_my_recommendation_report_content` (the two student-facing reads, structurally safe `RETURNS TABLE` shapes).

**SELECT RLS (the only RLS these two tables have):** one staff-only policy each — `super_admin`/`admin` see every row; `counsellor` sees a row if they authored it OR `counsellor_has_case_access()` grants them the student. A student has no RLS access to either table at all; their entire access surface is the two `get_my_*` RPCs.

## 4. Why no other migration was needed

Every other NW07 surface (dashboard, caseload, Discovery Session pages, profile verification, recommendation readiness, application readiness, tasks queue) reads through RPCs/tables that already existed before this milestone and needed no schema change — only the RLS widening in PART 1 made them return the right rows for a counsellor.

## 5. Explicitly NOT done

No migration in this milestone was applied to any database, local or remote. No `DROP`, no destructive `ALTER` of an existing column, no data backfill or fabricated row. No change to any table outside the 14 PART 1 policies and the 2 PART 2 tables. No change to Vercel configuration, environment variables, or any CI/CD file.
