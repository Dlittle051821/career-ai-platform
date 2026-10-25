# NW05.7 — Counsellor Verification Surfacing

Status: **COMPLETE**

## 1. What NW05.1's audit found, confirmed again here

The counsellor-verification backend was already fully secure before this milestone:

- `student_profile_section_provenance` (0013 PART 4) has exactly one write ("for all") RLS policy, gated on `is_admin_role(array['super_admin', 'admin'])` or an assigned counsellor — never on `student_user_id = auth.uid()`. The student-facing policy is SELECT-only.
- `student_recommendation_verifications` (0013 PART 5) is the same shape: one write policy, gated on an admin/counsellor role check plus `verified_by_counsellor_id = public.current_counsellor_id()` (the real caller's own counsellor id, never student-suppliable) — student policy is SELECT-only.
- The student-facing read path (`getMySectionProvenanceMap()`, `src/lib/supabase/profile-provenance.ts`) already hardcodes `note: null` with the comment "internal staff note — never shown to the student" — the counsellor's private note has never leaked to a student.
- Existing UI (`ProfileCounsellorCard.tsx` on `/profile`, `ReadinessBadge.tsx` on `/recommendations`) already surfaces verification state honestly and read-only — these pre-date NW05 and needed no change.

So, as the brief itself anticipated, this stage is mostly verification-and-documentation plus one new regression test — not new UI.

## 2. What NW05 itself adds to this picture

- NW05.2's `/studio` hub "Your journey so far" tile honestly surfaces the real career-recommendation readiness level (including "Counsellor verified" when applicable) via the same `READINESS_LEVEL_LABELS` vocabulary `ReadinessBadge.tsx` already uses — a new, cross-product surfacing point, built from the same real data, never a new verification concept.
- NW05.3's downgrade-only RPC is the one new write path this milestone introduces anywhere near this system — and it can only ever move a section's provenance DOWN to `SELF_ENTERED`, never up into a counsellor-attributed state. This stage's new test (below) specifically re-verifies that claim at the SQL-source level, not just by reading the English description.

## 3. New regression test: `src/lib/profile/nw05-provenance-verification-security-audit.test.ts`

A static source-text audit (9 tests, this codebase's established "no React Testing Library/jsdom" convention), verifying:

1. `student_profile_section_provenance`'s write policy is gated on an admin/counsellor role, never on row ownership alone, and the migration's own source still documents "no student INSERT/UPDATE policy anywhere."
2. `student_recommendation_verifications`'s write policy is gated the same way, plus the real counsellor's own id.
3. The NW05.3 proposed RPC's only `set provenance = '...'` assignment is the literal `'SELF_ENTERED'` — `'COUNSELLOR_ENTERED'`/`'COUNSELLOR_VERIFIED'` appear only inside the WHERE-clause guard that reads the CURRENT value, never after an assignment anywhere in the file. Also confirms the function takes no student-id parameter (scoped by `auth.uid()` only) and is granted only to `authenticated`.
4. `student-profile-actions.ts`'s RPC call site passes only `{ p_section_key: sectionKey }` — structurally incapable of sending a provenance value even if someone tried.
5. Every student-facing provenance/verification file (`profile-provenance.ts`, `ProfileCounsellorCard.tsx`, `ProvenanceSummaryCard.tsx`, `ReadinessBadge.tsx`) contains no Supabase write call at all, and the read function still nulls the private note.

Registered automatically — no `vitest.config.mts` change needed (`src/lib/profile/**/*.test.ts` already includes this directory).

## 4. Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean — 0 errors |
| `npx vitest run` | 134 files / 2182 tests — all passing (+1 file / +9 tests from this stage) |
| `npm run lint` | 0 errors, 18 pre-existing warnings (unchanged) |
| `npm run build` | Succeeds |

## 5. What this stage did not do

- Did not build a new "Counsellor Studio" or any counsellor-side feature — out of scope (the brief explicitly defers broader counsellor operations to NW07).
- Did not change any RLS policy or table — none needed changing; they were already correct.
- Did not surface raw internal counsellor notes, risk scores, or admin annotations anywhere — confirmed, not newly built.
