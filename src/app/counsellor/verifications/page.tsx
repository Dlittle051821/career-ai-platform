import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { getCounsellorDashboardData } from "@/lib/supabase/admin/counsellor-dashboard";

export const metadata: Metadata = { title: "Verifications" };

/**
 * NW07.5 — Verifications: the cross-case queue of caseload students who
 * have made real profile progress but have no COUNSELLOR_VERIFIED section
 * yet. Deliberately reuses getCounsellorDashboardData()'s own
 * computePendingVerificationFlags() rather than a second query — the same
 * honest, bounded-to-CASELOAD_SCAN_LIMIT heuristic the dashboard tile links
 * here with, restated as its own page instead of a 6-row preview. A
 * counsellor with a caseload larger than that scan limit is told so,
 * rather than being shown a silently incomplete "full" queue.
 */
export default async function CounsellorVerificationsPage() {
  const data = await getCounsellorDashboardData();
  const pending = data.caseload.filter((s) => s.pendingVerification);
  const scanWasBounded = data.summary.caseloadTotal > data.caseload.length;

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Counsellor Studio</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">Verifications</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Caseload students with real profile progress but nothing yet independently reviewed by a counsellor.
          Open a case to verify a section from its own Profile &amp; Academics panel.
        </p>
        {scanWasBounded ? (
          <p className="mt-2 max-w-2xl text-xs text-muted">
            Scanned the first {data.caseload.length} of {data.summary.caseloadTotal} cases in your caseload. Narrow
            your caseload view, or check back after working through this page, to see the rest.
          </p>
        ) : null}
      </div>

      {data.partialFailure ? (
        <Card className="mb-6 border-warning/30 bg-warning-light">
          <p className="text-sm text-warning">This queue couldn&apos;t load fully just now. Reload to retry.</p>
        </Card>
      ) : null}

      {pending.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nothing pending verification"
          description="Every caseload student with profile progress has at least one counsellor-verified section — or none have started yet."
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {pending.length} case{pending.length === 1 ? "" : "s"} awaiting a first verification
          </p>
          <AdminTable headers={["Student", "Profile", ""]}>
            {pending.map((s) => (
              <tr key={s.userId} className="hover:bg-surface-alt/50">
                <Td className="font-medium text-text">
                  <Link href={`/counsellor/students/${s.userId}`} className="hover:text-primary hover:underline">
                    {s.fullName || "Unnamed student"}
                  </Link>
                </Td>
                <Td className="text-text-soft">{s.profileCompletionPercent}% complete</Td>
                <Td>
                  <Link href={`/counsellor/students/${s.userId}`} className="text-sm font-semibold text-secondary-dark hover:text-primary">
                    Review case
                  </Link>
                </Td>
              </tr>
            ))}
          </AdminTable>
        </>
      )}
    </div>
  );
}
