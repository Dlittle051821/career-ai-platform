# NW07.4 — Discovery Session Workspace

## 1. Scope

`/counsellor/discovery-sessions` (list), `/counsellor/discovery-sessions/[id]` (detail + claim/assign/status), and `/counsellor/discovery-sessions/[id]/workspace` (the sections A–J Counsellor Workspace) — thin, counsellor-branded wrappers over the existing Discovery Session system (Milestone 11-B), not a second implementation of it.

## 2. What was built

- `src/app/counsellor/discovery-sessions/page.tsx` — list, adapted from `/admin/discovery-sessions/page.tsx`. Same status/unclaimed-only filters, reusing `listDiscoverySessions()` unchanged.
- `src/app/counsellor/discovery-sessions/[id]/page.tsx` — detail, adapted from `/admin/discovery-sessions/[id]/page.tsx`. Reuses `DiscoverySessionActionForm` unchanged and `listCounsellorOptions()` (gated on `requireAdmin()` — any real admin role, not a specific permission; see that function's own header comment) for the assignment picker, so a counsellor can claim an unclaimed request. The only difference from the admin page: the "View student record" link points at this route's own `/counsellor/students/[studentId]` instead of `/admin/students/[id]`.
- `src/app/counsellor/discovery-sessions/[id]/workspace/page.tsx` — the sections A–J Counsellor Workspace, a direct thin wrapper reusing `DiscoverySessionWorkspaceForm` and `getDiscoverySessionWorkspace()`/`saveDiscoverySessionWorkspace()` unchanged.
- `src/app/counsellor/discovery-sessions/actions.ts` and `.../[id]/workspace/actions.ts` — Server Action wrappers calling the identical `updateDiscoverySession()`/`saveDiscoverySessionWorkspace()` functions `/admin/discovery-sessions` already calls, with this route's own `revalidatePath()` targets.

## 3. Claiming an unclaimed request

A counsellor "claiming" an unassigned session is just an ordinary `assignedCounsellorId` write to their own counsellor id — the same `updateDiscoverySession()` path every assignment change goes through. RLS (Milestone 11-B's own PART 2 policy) is what actually decides whether a counsellor is allowed to write this particular row at all; the application layer performs no separate claim-specific check.

## 4. Verification

`npx tsc --noEmit` clean after each file in this stage. No new pure logic was introduced — every function this stage's UI calls already has its own existing test coverage from Milestone 11-B.
