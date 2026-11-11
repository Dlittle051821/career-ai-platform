# REJECTED: do not apply anything in this folder

`0023_counsellor_discovery_session_profile_read.sql` (CC-24) was **rejected** by an independent security review in November 2026. It must never be applied to QA or production.

The review found these problems:

1. A counsellor could gain access just by claiming an unassigned Discovery Session.
2. `student_user_id` could be changed by the counsellor holding the session, which moved the access to another student.
3. It granted SELECT on the whole `profiles` row, which is more than a counsellor needs.
4. Completed, cancelled and no-show sessions kept granting access.
5. Migration 0014 had the same assignment-based weaknesses, and this proposal didn't address them.
6. Its SQL tests printed results but never failed on unexpected access.

The replacement is `supabase/migrations-proposed/cc25/0023_cc25_counsellor_identity_least_privilege.sql`. It comes with:

- a rollback script;
- executable RLS tests that exit nonzero when a check fails;
- a read-only preflight;
- a review in `docs/cc25/CC25-02-SECURITY-ARCHITECTURE-AND-MIGRATION-REVIEW.md`.

These files are kept unchanged as the audit trail.

If a database ever received the CC-24 policy by mistake, the CC-25 migration drops it.
