import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ClipboardList, CalendarHeart, FileCheck2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AddNoteForm } from "@/components/admin/students/StudentActionForms";
import { ProfileProvenanceCard, type ProfileProvenanceSectionRow } from "@/components/admin/students/ProfileProvenanceCard";
import { RecommendationReadinessCard } from "@/components/admin/students/RecommendationReadinessCard";
import { NewRecommendationDraftForm } from "@/components/counsellor/NewRecommendationDraftForm";
import { getStudentDetail } from "@/lib/supabase/admin/students";
import { getStudentProfileSnapshotForAdmin } from "@/lib/supabase/admin/student-profile";
import { getSectionProvenanceMap } from "@/lib/supabase/admin/profile-provenance";
import { getRecommendationReadinessForAdmin } from "@/lib/supabase/admin/recommendation-readiness";
import { listDiscoverySessions } from "@/lib/supabase/admin/discovery-sessions";
import { listRecommendationDraftsForStudent } from "@/lib/supabase/admin/recommendation-drafts";
import { listApplicationDocumentsForAdminBatch } from "@/lib/supabase/admin/application-documents";
import { getApplicationChecklistItemsBatch } from "@/lib/supabase/admin/application-checklist";
import { getApplicationDocumentCompleteness, getApplicationDocumentReviewCompleteness, type ApplicationDocumentType } from "@/lib/applications/application-documents";
import { getApplicationReadiness, READINESS_APPROPRIATE_STAGES } from "@/lib/applications/application-readiness";
import { getCurrentAdmin } from "@/lib/supabase/admin-auth";
import { hasPermission } from "@/lib/admin/permissions";
import { calculateCompletion } from "@/lib/profile/completion";
import { ADMIN_STUDENT_STATUS_LABELS, APPLICATION_STAGE_LABELS } from "@/types/admin";
import { DISCOVERY_SESSION_STATUS_LABELS } from "@/types/discovery-session";
import { RECOMMENDATION_DRAFT_STATUS_LABELS, isRecommendationDraftStatus } from "@/lib/recommendations/drafts";
import { formatDiscoverySessionDateTime } from "@/lib/discovery-sessions/format";
import type { RecommendationReadiness, RecommendationType } from "@/types/recommendation-readiness";
import {
  addStudentNoteAction,
  setSectionProvenanceAction,
  setRecommendationVerificationAction,
  clearRecommendationVerificationAction,
  createRecommendationDraftAction,
} from "../actions";

interface StudentCasePageProps {
  params: Promise<{ studentId: string }>;
}

export const metadata: Metadata = { title: "Student Case" };

/**
 * NW07.3 — Student Case Workspace. Composes the SAME reads/components
 * `/admin/students/[id]` already uses (getStudentDetail, ProfileProvenance
 * Card, RecommendationReadinessCard) plus two genuinely new additions: a
 * per-student Discovery Sessions list and the Recommendation Workflow
 * panel (NW07.6). Case ownership/IDOR protection is NOT re-implemented
 * here — `getStudentDetail()`'s own `profiles` read is RLS-scoped (dual
 * basis, after NW07_counsellor_studio_foundation.sql PART 1), so a
 * counsellor who changes the URL's studentId to a case they don't have
 * gets `student === null` here and an honest 404, never another
 * counsellor's data. No admin_student_meta write form is rendered here —
 * the `counsellor` role holds no `students:write` permission at all
 * (operational status/reassignment stay admin-only; shown read-only below).
 */
export default async function CounsellorStudentCasePage({ params }: StudentCasePageProps) {
  const { studentId } = await params;
  const [student, admin] = await Promise.all([getStudentDetail(studentId), getCurrentAdmin()]);
  if (!student) notFound();

  const canReadProfile = hasPermission(admin?.role, "profile-verification:read");
  const canWriteProfile = hasPermission(admin?.role, "profile-verification:write");
  const canReadReadiness = hasPermission(admin?.role, "recommendation-readiness:read");
  const canWriteReadiness = hasPermission(admin?.role, "recommendation-readiness:write");
  const canReadRecommendationDrafts = hasPermission(admin?.role, "recommendation-drafts:read");
  const canWriteRecommendationDrafts = hasPermission(admin?.role, "recommendation-drafts:write");

  let provenanceSections: ProfileProvenanceSectionRow[] = [];
  let recommendationReadiness: Record<RecommendationType, RecommendationReadiness> | null = null;
  let profileCompletionPercent = student.profileCompletionPercent;
  if (canReadProfile || canReadReadiness) {
    const [snapshot, provenanceMap, readiness] = await Promise.all([
      getStudentProfileSnapshotForAdmin(studentId),
      canReadProfile ? getSectionProvenanceMap(studentId) : Promise.resolve(null),
      canReadReadiness ? getRecommendationReadinessForAdmin(studentId) : Promise.resolve(null),
    ]);
    const completion = calculateCompletion(snapshot);
    profileCompletionPercent = completion.percent;
    if (canReadProfile && provenanceMap) {
      provenanceSections = completion.sections.map((s) => ({
        key: s.key,
        label: s.label,
        weight: s.weight,
        required: s.required,
        complete: s.complete,
        provenance: provenanceMap[s.key as keyof typeof provenanceMap],
      }));
    }
    recommendationReadiness = readiness;
  }

  const [sessionsResult, recommendationDrafts] = await Promise.all([
    listDiscoverySessions({ studentUserId: studentId }),
    canReadRecommendationDrafts ? listRecommendationDraftsForStudent(studentId) : Promise.resolve([]),
  ]);

  // NW07.5 — Application Readiness, the 4th distinct readiness concept
  // (alongside Discovery Session completion, Profile Verification, and
  // Recommendation Readiness): reuses getApplicationReadiness() unchanged
  // (built for `/admin/applications/[id]`) over this student's own
  // applications. Gated on BOTH `application-documents:read` and
  // `application-documents:review` — the two permissions the underlying
  // batch reads already require — so a role with neither (or only one)
  // never sees a readiness claim it can't back with real document/
  // checklist data.
  const applicationIds = student.applications.map((a) => a.id);
  const canReadApplicationReadiness =
    hasPermission(admin?.role, "application-documents:read") && hasPermission(admin?.role, "application-documents:review") && applicationIds.length > 0;
  let documentsByApplication: Awaited<ReturnType<typeof listApplicationDocumentsForAdminBatch>> = new Map();
  let checklistByApplication: Awaited<ReturnType<typeof getApplicationChecklistItemsBatch>> = new Map();
  if (canReadApplicationReadiness) {
    [documentsByApplication, checklistByApplication] = await Promise.all([
      listApplicationDocumentsForAdminBatch(applicationIds),
      getApplicationChecklistItemsBatch(applicationIds),
    ]);
  }

  const boundNoteAction = addStudentNoteAction.bind(null, studentId);
  const boundProvenanceAction = setSectionProvenanceAction.bind(null, studentId);
  const boundSetVerificationAction = setRecommendationVerificationAction.bind(null, studentId);
  const boundClearVerificationAction = clearRecommendationVerificationAction.bind(null, studentId);
  const boundCreateDraftAction = createRecommendationDraftAction.bind(null, studentId);

  return (
    <div className="max-w-5xl">
      <Link href="/counsellor/students" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to my caseload
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Student Case</p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{student.fullName || "Unnamed student"}</h1>
          <p className="mt-2 text-sm text-muted">
            {student.email ?? "No email on file"} · {student.phone ?? "No phone on file"} · Registered{" "}
            {new Date(student.createdAt).toLocaleDateString("en-IN")}
          </p>
        </div>
        <StatusBadge status={student.status} labelOverride={ADMIN_STUDENT_STATUS_LABELS[student.status]} />
      </div>

      <Card className="mb-6 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-text">Profile completion</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-alt">
            <div className="h-full rounded-full bg-secondary" style={{ width: `${profileCompletionPercent}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted">{profileCompletionPercent}% complete — self-reported, read-only.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-text">Assigned counsellor</p>
          <p className="mt-2 text-sm text-text-soft">
            {student.assignedCounsellorName ?? "Unassigned"} — reassignment is an admin-only action.
          </p>
        </div>
      </Card>

      {/* Overview / Profile & Academics */}
      {canReadProfile && (
        <ProfileProvenanceCard
          sections={provenanceSections}
          completionPercent={profileCompletionPercent}
          canWrite={canWriteProfile}
          hasCounsellorId={Boolean(admin?.counsellorId)}
          action={boundProvenanceAction}
        />
      )}

      {/* Discovery Sessions */}
      <Card className="mb-6">
        <div className="flex items-center gap-2">
          <CalendarHeart aria-hidden="true" className="h-4 w-4 text-secondary-dark" />
          <h2 className="text-base font-semibold text-primary">Discovery Sessions ({sessionsResult.items.length})</h2>
        </div>
        {sessionsResult.items.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No Discovery Session booked yet.</p>
        ) : (
          <div className="mt-3">
            <AdminTable headers={["Status", "Scheduled", "Preferred contact", ""]}>
              {sessionsResult.items.map((s) => (
                <tr key={s.id}>
                  <Td>
                    <StatusBadge status={s.status} labelOverride={DISCOVERY_SESSION_STATUS_LABELS[s.status]} />
                  </Td>
                  <Td className="text-text-soft">{s.scheduledAt ? formatDiscoverySessionDateTime(s.scheduledAt) : "Not scheduled"}</Td>
                  <Td className="text-text-soft">{s.preferredContactMethod ?? "No preference"}</Td>
                  <Td>
                    <Link href={`/counsellor/discovery-sessions/${s.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                      Open
                    </Link>
                  </Td>
                </tr>
              ))}
            </AdminTable>
          </div>
        )}
      </Card>

      {/* Verification & Readiness */}
      {canReadReadiness && recommendationReadiness && (
        <RecommendationReadinessCard
          readiness={recommendationReadiness}
          canWrite={canWriteReadiness}
          hasCounsellorId={Boolean(admin?.counsellorId)}
          setAction={boundSetVerificationAction}
          clearAction={boundClearVerificationAction}
        />
      )}

      {/* Recommendations */}
      {canReadRecommendationDrafts && (
        <Card className="mb-6">
          <div className="flex items-center gap-2">
            <FileCheck2 aria-hidden="true" className="h-4 w-4 text-secondary-dark" />
            <h2 className="text-base font-semibold text-primary">Recommendation reports ({recommendationDrafts.length})</h2>
          </div>
          <p className="mt-1 text-sm text-muted">
            Drafted from this student&apos;s verified profile, readiness, and Discovery Session record — never a
            fabricated eligibility claim or a guarantee of admission. A draft only reaches the student once an
            independent reviewer approves it and it is released.
          </p>
          {recommendationDrafts.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No recommendation report started yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {recommendationDrafts.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                  <Link href={`/counsellor/recommendations/${d.id}`} className="font-medium text-text hover:text-primary hover:underline">
                    {d.title}
                  </Link>
                  {isRecommendationDraftStatus(d.status) ? (
                    <Badge tone={d.status === "released_to_student" ? "success" : d.status === "changes_requested" ? "warning" : "neutral"}>
                      {RECOMMENDATION_DRAFT_STATUS_LABELS[d.status]}
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canWriteRecommendationDrafts && (
            <div className="mt-5 border-t border-border pt-5">
              <NewRecommendationDraftForm action={boundCreateDraftAction} />
            </div>
          )}
        </Card>
      )}

      {/* Abroad Applications / Applications */}
      <Card className="mb-6">
        <div className="flex items-center gap-2">
          <ClipboardList aria-hidden="true" className="h-4 w-4 text-secondary-dark" />
          <h2 className="text-base font-semibold text-primary">Applications ({student.applications.length})</h2>
        </div>
        {student.applications.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No applications recorded yet.</p>
        ) : (
          <div className="mt-3">
            <AdminTable headers={["University", "Course", "Stage", "Intake", "Readiness"]}>
              {student.applications.map((a) => {
                let readinessBadge: ReactNode = <span className="text-xs text-muted">—</span>;
                if (canReadApplicationReadiness) {
                  if (!READINESS_APPROPRIATE_STAGES.includes(a.stage)) {
                    readinessBadge = <span className="text-xs text-muted">Already past preparation</span>;
                  } else {
                    const documents = (documentsByApplication.get(a.id) ?? []).map((d) => ({
                      documentType: d.documentType as ApplicationDocumentType,
                      originalFilename: d.originalFilename,
                      reviewStatus: d.reviewStatus,
                    }));
                    const checklistItems = checklistByApplication.get(a.id) ?? [];
                    const readiness = getApplicationReadiness({
                      stage: a.stage,
                      documentCompleteness: getApplicationDocumentCompleteness(documents),
                      documentReviewCompleteness: getApplicationDocumentReviewCompleteness(documents),
                      manualChecklistItems: checklistItems,
                    });
                    readinessBadge = readiness.isReady ? (
                      <Badge tone="success">Ready</Badge>
                    ) : (
                      <Badge tone="warning">
                        {readiness.blockers.length} blocker{readiness.blockers.length === 1 ? "" : "s"}
                      </Badge>
                    );
                  }
                }
                return (
                  <tr key={a.id}>
                    <Td className="font-medium text-text">
                      <Link href={`/admin/applications/${a.id}`} className="hover:text-primary hover:underline">
                        {a.universityName ?? "—"}
                      </Link>
                    </Td>
                    <Td className="text-text-soft">{a.courseName ?? "—"}</Td>
                    <Td>
                      <StatusBadge status={a.stage} labelOverride={APPLICATION_STAGE_LABELS[a.stage]} />
                    </Td>
                    <Td className="text-text-soft">{a.intake ?? "—"}</Td>
                    <Td>{readinessBadge}</Td>
                  </tr>
                );
              })}
            </AdminTable>
          </div>
        )}
        <div className="mt-3">
          <LinkButton href="/admin/applications" size="sm" variant="outline">
            Open full Applications workspace
          </LinkButton>
        </div>
      </Card>

      {/* Activity — internal case notes */}
      <Card>
        <h2 className="text-base font-semibold text-primary">Case activity &amp; notes</h2>
        <div className="mt-3 mb-5">
          <AddNoteForm action={boundNoteAction} />
        </div>
        {student.notes.length === 0 ? (
          <p className="text-sm text-muted">No notes yet.</p>
        ) : (
          <ul className="space-y-3">
            {student.notes.map((n) => (
              <li key={n.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
                <p className="text-sm text-text-soft">{n.note}</p>
                <p className="mt-1 text-xs text-muted">
                  {n.authorName ?? "Counsellor"} · {new Date(n.createdAt).toLocaleString("en-IN")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
