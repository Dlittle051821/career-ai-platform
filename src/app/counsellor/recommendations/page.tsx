import type { Metadata } from "next";
import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { listMyRecommendationDraftsWithStudentNames } from "@/lib/supabase/admin/recommendation-drafts";
import { RECOMMENDATION_DRAFT_STATUS_LABELS, isRecommendationDraftStatus } from "@/lib/recommendations/drafts";

export const metadata: Metadata = { title: "Recommendations" };

function statusTone(status: string): "success" | "warning" | "neutral" {
  if (status === "released_to_student") return "success";
  if (status === "changes_requested" || status === "submitted_for_review") return "warning";
  return "neutral";
}

/**
 * NW07.6 — "Recommendations": every recommendation report the viewer can
 * see across their caseload (RLS: a counsellor's own-authored drafts plus
 * every case they have dual-basis access to; an admin sees every draft).
 * Reuses listMyRecommendationDraftsWithStudentNames() unchanged — this page
 * is a presentation layer, not a second query path.
 */
export default async function CounsellorRecommendationsPage() {
  const drafts = await listMyRecommendationDraftsWithStudentNames();

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Counsellor Studio</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Recommendations</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Every recommendation report you&apos;re authoring, reviewing, or that&apos;s been released — across your whole
          caseload. A report reaches the student only once an independent reviewer approves it and it is released.
        </p>
      </div>

      {drafts.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="No recommendation reports yet"
          description="Start one from a student's case — open a case and use the Recommendations panel."
        />
      ) : (
        <AdminTable headers={["Student", "Report", "Status", ""]}>
          {drafts.map((d) => (
            <tr key={d.id} className="hover:bg-surface-alt/50">
              <Td className="font-medium text-text">
                <Link href={`/counsellor/students/${d.studentUserId}`} className="hover:text-primary hover:underline">
                  {d.studentName || "Unnamed student"}
                </Link>
                {d.studentEmail ? <div className="text-xs font-normal text-muted">{d.studentEmail}</div> : null}
              </Td>
              <Td className="text-text-soft">{d.title}</Td>
              <Td>{isRecommendationDraftStatus(d.status) ? <Badge tone={statusTone(d.status)}>{RECOMMENDATION_DRAFT_STATUS_LABELS[d.status]}</Badge> : null}</Td>
              <Td>
                <Link href={`/counsellor/recommendations/${d.id}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                  Open
                </Link>
              </Td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}
