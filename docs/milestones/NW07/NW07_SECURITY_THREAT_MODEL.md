# NW07 — Security Threat Model

## 1. Methodology

STRIDE, applied specifically to the two things NW07 changes at the data layer: the counsellor case-access RLS widening (PART 1) and the new Recommendation Workflow (PART 2). Every mitigation below is backed by a passing test — either the existing codebase's own established test, or a new assertion in `recommendation-drafts-migration-security.test.ts` written specifically to pin this behaviour down against regression.

## 2. Spoofing / identity

**Risk:** a request claims to act as a different counsellor, or a different student, than the authenticated session actually is.
**Mitigation:** every `/counsellor/**` read goes through `createClient()` — the anon key + session cookies path (`createServerClient`), genuinely RLS-evaluated as the signed-in user, never a service-role bypass. Every new RPC (`staff_*`, `get_my_*`) reads the caller's identity from `auth.uid()`/`current_counsellor_id()` server-side; no RPC accepts a caller-supplied "acting as" id for anything security-relevant. **Self-approval prevention is the sharpest instance of this**: `staff_review_recommendation_draft()` compares `auth.uid()` against the draft's own `created_by` — a counsellor cannot spoof being a different, authorized reviewer merely by calling the RPC from their own authenticated session, because the check is about who they actually are, not who they claim to be reviewing as.

## 3. Tampering

**Risk:** a counsellor or student writes data they shouldn't be able to — approving their own draft, editing a submitted/approved/released draft's content, writing to `recommendation_drafts`/`recommendation_draft_versions` directly instead of through an RPC.
**Mitigation:** both new tables have **zero** insert/update/delete RLS policy for any role, including `super_admin`/`admin` — every write is one of 9 `SECURITY DEFINER` RPCs, each re-validating the caller's authorization and the current status transition itself (never trusting that the UI only showed a button when the transition was valid). `staff_update_recommendation_draft_content()` only accepts `draft`/`changes_requested` as the current status — a submitted, approved, released, or archived draft's content cannot be tampered with via this RPC regardless of role. Version history is append-only: no RPC ever `UPDATE`s an existing `recommendation_draft_versions` row.

## 4. Repudiation

**Risk:** a counsellor or reviewer later denies having authored, submitted, approved, or released a report.
**Mitigation:** every state transition writes its own actor+timestamp pair in the same statement as the status change (`approved_at`/`approved_by` set together, never one without the other — enforced by a CHECK constraint, not merely application discipline). `recordAuditLog()` records every staff-side mutation to `admin_audit_log` with `entityType: "recommendation_draft"` (added to `AUDIT_ENTITY_TYPES` this milestone). The full version history (`recommendation_draft_versions`, never deleted) is itself an un-repudiable record of exactly what content existed at each point.

## 5. Information disclosure — the two biggest risks this milestone touches

**Risk A (fixed by this milestone): a Discovery-Session-only counsellor cannot read a student's actual profile.** This is a *disclosure-of-service* gap, not a leak — documented fully in `NW07_DATABASE_CHANGE_PLAN.md` §2 and fixed by the PART 1 RLS widening.

**Risk B (the one this milestone had to design against from scratch): a student reads a recommendation report before it's released, or reads another student's report, or reads internal-only fields (`review_notes`, reviewer/approver identity).** Mitigated three independent ways: (1) zero student RLS policy on either table — a student cannot query them directly no matter what client-side code runs; (2) the two `get_my_*` RPCs filter to the caller's own rows AND `status = 'released_to_student'` only, inside the RPC body, re-checked on every call rather than cached; (3) the RPCs' `RETURNS TABLE` column lists structurally omit every internal-only column — a future column added to `recommendation_drafts` cannot silently start leaking through these two functions, because the column list is fixed and explicit, not a filtered `SELECT *`.

**Risk C: a counsellor sees a case/draft outside their own caseload.** Mitigated by `counsellor_has_case_access()` being the single, reused predicate for both the widened RLS policies and every new RPC — one rule, enforced in one place, rather than re-derived (and potentially inconsistently re-derived) in 14+ separate policies.

## 6. Denial of service

No new unbounded query was introduced. `getCounsellorDashboardData()`'s own `computePendingVerificationFlags()` is explicitly bounded to `CASELOAD_SCAN_LIMIT = 20` students per dashboard load, with the bound disclosed to the viewer rather than silently truncated. The new batch reads (`listApplicationDocumentsForAdminBatch`, `getApplicationChecklistItemsBatch`) are called only with the bounded set of one student's own application ids, never an unbounded platform-wide id list — matching the existing caller contract those functions' own header comments already document.

## 7. Elevation of privilege

**Risk:** a `counsellor`-role account gains admin-level capability through this milestone's new surface.
**Mitigation:** `counsellor-studio:read` and `recommendation-drafts:read`/`write` are additive, narrow permissions granted alongside the role's existing permission set — nothing in this milestone widens what `counsellor` can do to `students:write`, `counsellors:read`, pricing, or any other module's permission. The self-approval-prevention check in `staff_review_recommendation_draft()` has **no role-based exception** — this was deliberately checked first, to confirm an `admin`-role account cannot approve their own authored draft either, closing off the most obvious "just use the more-privileged role to bypass the control" escalation path.

## 8. Conclusion

NW07's two data-layer changes are a net security *improvement* over the pre-NW07 state: PART 1 closes a real, pre-existing gap (even though it manifested as "counsellor can't do their job" rather than "attacker can read data," it was still an inconsistently-applied RLS model that could have caused confusion or workarounds); PART 2 introduces a new write surface designed from the start around the two hardest constraints in the brief (self-approval prevention, student-sees-only-released) at the database layer, not merely in application code that a future page could bypass.
