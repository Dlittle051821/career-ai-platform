import "server-only";
import { requireAdminPermission } from "../admin-auth";
import { listStudents, type StudentFilters } from "./students";
import { listDiscoverySessions } from "./discovery-sessions";
import { getSectionProvenanceMap } from "./profile-provenance";
import { listMyRecommendationDrafts } from "./recommendation-drafts";
import { listMyOpenStaffApplicationTasks } from "./application-tasks";
import type { AdminStudentSummary } from "@/types/admin";
import type { DiscoverySession } from "@/types/discovery-session";
import type { AdminRecommendationDraft } from "./recommendation-drafts";
import type { AdminApplicationTask } from "./application-tasks";
import { isApplicationTaskOverdue, isApplicationTaskStatus } from "@/lib/applications/application-tasks";
import { isRecommendationDraftStatus, summarizeRecommendationDrafts, type RecommendationDraftStatus } from "@/lib/recommendations/drafts";

/**
 * NW07.2 — Counsellor Studio Dashboard composition. Introduces ZERO new
 * reads beyond what's already correctly RLS-scoped: `listStudents()` (My
 * Caseload — after NW07_counsellor_studio_foundation.sql PART 1, the
 * `profiles`/`admin_student_meta` RLS this function's own query relies on
 * already returns exactly a counsellor's own dual-basis cases, no filter
 * needed here), `listDiscoverySessions()`, `getSectionProvenanceMap()` (per
 * caseload student — bounded, see §"Pending verifications" below),
 * `listMyRecommendationDrafts()`, `listMyOpenStaffApplicationTasks()`. This
 * module only composes and tallies what those already return — see
 * docs/milestones/NW07/NW07_02_COUNSELLOR_DASHBOARD.md for the full writeup.
 *
 * Deliberately does NOT call listCounsellorWorkload()/listCounsellors()/
 * getCounsellorById() — those require "counsellors:read", which the
 * `counsellor` role does not hold (src/lib/admin/permissions.ts). Every
 * count below is derived from data the viewer is independently permitted
 * to read for their own purposes (students/discovery-sessions/
 * recommendation-drafts/application-tasks), never from the counsellor
 * directory.
 */

export interface CounsellorDashboardSummary {
  caseloadCount: number;
  caseloadTotal: number;
  upcomingSessionCount: number;
  unclaimedSessionRequestCount: number;
  pendingVerificationCount: number;
  recommendationDraftsAwaitingActionCount: number;
  operationalTaskCount: number;
  overdueOperationalTaskCount: number;
}

export interface CounsellorCaseloadItem extends AdminStudentSummary {
  pendingVerification: boolean;
}

export interface CounsellorDashboardData {
  summary: CounsellorDashboardSummary;
  caseload: CounsellorCaseloadItem[];
  upcomingSessions: DiscoverySession[];
  recommendationDrafts: AdminRecommendationDraft[];
  operationalTasks: AdminApplicationTask[];
  /** True if any read this page depends on failed — the page must show a truthful error state for that section, never a silent empty one. */
  partialFailure: boolean;
}

const CASELOAD_SCAN_LIMIT = 20;

/**
 * "Pending verification": a caseload student who has made real profile
 * progress (profileCompletionPercent > 0) but has ZERO sections carrying
 * COUNSELLOR_VERIFIED provenance yet — i.e., nothing on their profile has
 * ever been independently reviewed by a counsellor. An honest, bounded
 * heuristic over the dashboard's own CASELOAD_SCAN_LIMIT (not a platform-
 * wide scan) — documented here, never silently claimed as exhaustive for a
 * larger caseload. A student with 0% completion is never flagged (there is
 * nothing yet worth verifying).
 */
async function computePendingVerificationFlags(students: AdminStudentSummary[]): Promise<Map<string, boolean>> {
  const candidates = students.filter((s) => s.profileCompletionPercent > 0);
  const flags = new Map<string, boolean>();
  await Promise.all(
    candidates.map(async (s) => {
      try {
        const provenanceMap = await getSectionProvenanceMap(s.userId);
        const hasAnyVerified = Object.values(provenanceMap).some((p) => p.provenance === "COUNSELLOR_VERIFIED");
        flags.set(s.userId, !hasAnyVerified);
      } catch {
        // Fail closed for this one student's flag only — never let one
        // failed lookup break the whole dashboard; it simply isn't flagged.
        flags.set(s.userId, false);
      }
    })
  );
  return flags;
}

export async function getCounsellorDashboardData(filters: StudentFilters = {}): Promise<CounsellorDashboardData> {
  await requireAdminPermission("counsellor-studio:read");

  let partialFailure = false;

  const [studentsResult, scheduledSessionsResult, unclaimedResult, draftsResult, tasksResult] = await Promise.all([
    listStudents({ ...filters, page: filters.page ?? 1 }).catch(() => {
      partialFailure = true;
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }),
    listDiscoverySessions({ status: "scheduled" }).catch(() => {
      partialFailure = true;
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }),
    listDiscoverySessions({ status: "requested", unassignedOnly: true }).catch(() => {
      partialFailure = true;
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }),
    listMyRecommendationDrafts().catch(() => {
      partialFailure = true;
      return [] as AdminRecommendationDraft[];
    }),
    listMyOpenStaffApplicationTasks().catch(() => {
      partialFailure = true;
      return [] as AdminApplicationTask[];
    }),
  ]);

  const scanStudents = studentsResult.items.slice(0, CASELOAD_SCAN_LIMIT);
  const pendingFlags = await computePendingVerificationFlags(scanStudents);

  const caseload: CounsellorCaseloadItem[] = studentsResult.items.map((s) => ({
    ...s,
    pendingVerification: pendingFlags.get(s.userId) ?? false,
  }));

  // "Upcoming" = scheduled sessions actually assigned to the viewer — a
  // counsellor's own commitment, not every unclaimed/other-counsellor row
  // RLS happens to also return. An admin viewing this page sees every
  // scheduled session (admin RLS has no assignment restriction at all).
  const upcomingSessions = scheduledSessionsResult.items;

  const recommendationCounts = summarizeRecommendationDrafts(
    draftsResult
      .filter((d) => isRecommendationDraftStatus(d.status))
      .map((d) => ({ id: d.id, status: d.status as RecommendationDraftStatus, createdBy: d.createdBy }))
  );
  const recommendationDraftsAwaitingAction = recommendationCounts.changesRequestedCount + recommendationCounts.awaitingReviewCount + recommendationCounts.approvedReadyToReleaseCount;

  const now = new Date();
  const overdueOperationalTaskCount = tasksResult.filter(
    (t) => isApplicationTaskStatus(t.status) && isApplicationTaskOverdue(t.status, t.dueDate, now)
  ).length;

  const pendingVerificationCount = Array.from(pendingFlags.values()).filter(Boolean).length;

  return {
    summary: {
      caseloadCount: caseload.length,
      caseloadTotal: studentsResult.total,
      upcomingSessionCount: upcomingSessions.length,
      unclaimedSessionRequestCount: unclaimedResult.total,
      pendingVerificationCount,
      recommendationDraftsAwaitingActionCount: recommendationDraftsAwaitingAction,
      operationalTaskCount: tasksResult.length,
      overdueOperationalTaskCount,
    },
    caseload,
    upcomingSessions,
    recommendationDrafts: draftsResult,
    operationalTasks: tasksResult,
    partialFailure,
  };
}
