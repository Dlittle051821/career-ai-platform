import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ClipboardList, Contact, Signature, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { StudentStatusForm, AssignCounsellorForm, AddNoteForm } from "@/components/admin/students/StudentActionForms";
import { ProfileProvenanceCard, type ProfileProvenanceSectionRow } from "@/components/admin/students/ProfileProvenanceCard";
import { RecommendationReadinessCard } from "@/components/admin/students/RecommendationReadinessCard";
import { getStudentDetail } from "@/lib/supabase/admin/students";
import { listCounsellorOptions } from "@/lib/supabase/admin/counsellors";
import { getStudentProfileSnapshotForAdmin } from "@/lib/supabase/admin/student-profile";
import { getSectionProvenanceMap } from "@/lib/supabase/admin/profile-provenance";
import { getRecommendationReadinessForAdmin } from "@/lib/supabase/admin/recommendation-readiness";
import { getCurrentAdmin } from "@/lib/supabase/admin-auth";
import { hasPermission } from "@/lib/admin/permissions";
import { calculateCompletion } from "@/lib/profile/completion";
import { formatMoney } from "@/lib/admin/money";
import { APPLICATION_STAGE_LABELS, LEAD_STAGE_LABELS } from "@/types/admin";
import type { RecommendationReadiness, RecommendationType } from "@/types/recommendation-readiness";
import {
  updateStudentStatusAction,
  assignCounsellorAction,
  addStudentNoteAction,
  setSectionProvenanceAction,
  setRecommendationVerificationAction,
  clearRecommendationVerificationAction,
} from "../actions";

interface StudentDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Student" };

export default async function StudentDetailPage({ params }: StudentDetailPageProps) {
  const { id } = await params;
  const [student, counsellorOptions, admin] = await Promise.all([getStudentDetail(id), listCounsellorOptions(), getCurrentAdmin()]);
  if (!student) notFound();

  const boundStatusAction = updateStudentStatusAction.bind(null, id);
  const boundAssignAction = assignCounsellorAction.bind(null, id);
  const boundNoteAction = addStudentNoteAction.bind(null, id);
  const boundProvenanceAction = setSectionProvenanceAction.bind(null, id);
  const boundSetVerificationAction = setRecommendationVerificationAction.bind(null, id);
  const boundClearVerificationAction = clearRecommendationVerificationAction.bind(null, id);

  // Milestone 11-C1/C2 — Profile Completeness + Counsellor Verification,
  // and Recommendation Readiness. Every role that can reach this page
  // today (super_admin/admin/counsellor/analyst — see
  // src/lib/admin/permissions.ts) also holds both "...:read" permissions
  // below, but each is checked explicitly (rather than assumed) so its
  // card simply disappears instead of crashing the page if that ever
  // drifts. Both cards are computed from the same profile snapshot, fetched
  // once and shared, rather than fetching it twice.
  const canReadProfile = hasPermission(admin?.role, "profile-verification:read");
  const canWriteProfile = hasPermission(admin?.role, "profile-verification:write");
  const canReadReadiness = hasPermission(admin?.role, "recommendation-readiness:read");
  const canWriteReadiness = hasPermission(admin?.role, "recommendation-readiness:write");

  let provenanceSections: ProfileProvenanceSectionRow[] = [];
  let recommendationReadiness: Record<RecommendationType, RecommendationReadiness> | null = null;
  let profileCompletionPercent = student.profileCompletionPercent;
  if (canReadProfile || canReadReadiness) {
    const [snapshot, provenanceMap, readiness] = await Promise.all([
      getStudentProfileSnapshotForAdmin(id),
      canReadProfile ? getSectionProvenanceMap(id) : Promise.resolve(null),
      canReadReadiness ? getRecommendationReadinessForAdmin(id) : Promise.resolve(null),
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

  return (
    <div className="max-w-5xl">
      <Link href="/admin/students" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to students
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Students</p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{student.fullName || "Unnamed student"}</h1>
          <p className="mt-2 text-sm text-muted">
            {student.email ?? "No email on file"} · {student.phone ?? "No phone on file"} · Registered{" "}
            {new Date(student.createdAt).toLocaleDateString("en-IN")}
          </p>
        </div>
        <StatusBadge status={student.status} />
      </div>

      <Card className="mb-6">
        <p className="text-sm font-medium text-text">Profile completion</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-alt">
          <div className="h-full rounded-full bg-secondary" style={{ width: `${profileCompletionPercent}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-muted">{profileCompletionPercent}% complete — self-reported, not editable from admin.</p>
      </Card>

      {canReadProfile && (
        <ProfileProvenanceCard
          sections={provenanceSections}
          completionPercent={profileCompletionPercent}
          canWrite={canWriteProfile}
          hasCounsellorId={Boolean(admin?.counsellorId)}
          action={boundProvenanceAction}
        />
      )}

      {canReadReadiness && recommendationReadiness && (
        <RecommendationReadinessCard
          readiness={recommendationReadiness}
          canWrite={canWriteReadiness}
          hasCounsellorId={Boolean(admin?.counsellorId)}
          setAction={boundSetVerificationAction}
          clearAction={boundClearVerificationAction}
        />
      )}

      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold text-primary">Operational status</h2>
          <div className="mt-3">
            <StudentStatusForm action={boundStatusAction} currentStatus={student.status} />
          </div>
        </Card>
        <Card>
          <h2 className="text-base font-semibold text-primary">Counsellor assignment</h2>
          <div className="mt-3">
            <AssignCounsellorForm action={boundAssignAction} currentCounsellorId={student.assignedCounsellorId} counsellorOptions={counsellorOptions} />
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <div className="flex items-center gap-2">
          <Contact aria-hidden="true" className="h-4 w-4 text-secondary-dark" />
          <h2 className="text-base font-semibold text-primary">Linked leads ({student.leads.length})</h2>
        </div>
        {student.leads.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No lead converted into this student yet.</p>
        ) : (
          <div className="mt-3">
            <AdminTable headers={["Lead", "Stage", "Source", "Created"]}>
              {student.leads.map((l) => (
                <tr key={l.id}>
                  <Td className="font-medium text-text">{l.fullName}</Td>
                  <Td>
                    <StatusBadge status={l.stage} labelOverride={LEAD_STAGE_LABELS[l.stage]} />
                  </Td>
                  <Td className="text-text-soft">{l.source ?? "—"}</Td>
                  <Td className="text-text-soft">{new Date(l.createdAt).toLocaleDateString("en-IN")}</Td>
                </tr>
              ))}
            </AdminTable>
          </div>
        )}
      </Card>

      <Card className="mb-6">
        <div className="flex items-center gap-2">
          <ClipboardList aria-hidden="true" className="h-4 w-4 text-secondary-dark" />
          <h2 className="text-base font-semibold text-primary">Applications ({student.applications.length})</h2>
        </div>
        {student.applications.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No applications recorded yet.</p>
        ) : (
          <div className="mt-3">
            <AdminTable headers={["University", "Course", "Stage", "Intake"]}>
              {student.applications.map((a) => (
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
                </tr>
              ))}
            </AdminTable>
          </div>
        )}
      </Card>

      <Card className="mb-6">
        <div className="flex items-center gap-2">
          <Wallet aria-hidden="true" className="h-4 w-4 text-secondary-dark" />
          <h2 className="text-base font-semibold text-primary">Payments ({student.payments.length})</h2>
        </div>
        {student.payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No payment records yet — this is tracking only, never a live processor.</p>
        ) : (
          <div className="mt-3">
            <AdminTable headers={["Invoice", "Amount", "Status", "Due date"]}>
              {student.payments.map((p) => (
                <tr key={p.id}>
                  <Td className="font-medium text-text">{p.invoiceReference ?? "—"}</Td>
                  <Td className="text-text-soft">{formatMoney(p.amountMinorUnits, p.currency)}</Td>
                  <Td>
                    <StatusBadge status={p.status} />
                  </Td>
                  <Td className="text-text-soft">{p.dueDate ? new Date(p.dueDate).toLocaleDateString("en-IN") : "—"}</Td>
                </tr>
              ))}
            </AdminTable>
          </div>
        )}
      </Card>

      <Card className="mb-6">
        <div className="flex items-center gap-2">
          <Signature aria-hidden="true" className="h-4 w-4 text-secondary-dark" />
          <h2 className="text-base font-semibold text-primary">Agreements ({student.agreements.length})</h2>
        </div>
        {student.agreements.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No agreements recorded yet.</p>
        ) : (
          <div className="mt-3">
            <AdminTable headers={["Type", "Status", "Signature"]}>
              {student.agreements.map((a) => (
                <tr key={a.id}>
                  <Td className="font-medium text-text">{a.agreementType}</Td>
                  <Td>
                    <StatusBadge status={a.status} />
                  </Td>
                  <Td>
                    <StatusBadge status={a.signatureStatus} />
                  </Td>
                </tr>
              ))}
            </AdminTable>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-primary">Internal notes</h2>
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
                  {n.authorName ?? "Admin"} · {new Date(n.createdAt).toLocaleString("en-IN")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
