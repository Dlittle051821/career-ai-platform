import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, FileCheck2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/supabase/profile";
import { listMyRecommendationReports } from "@/lib/supabase/education/recommendation-reports";

export const metadata: Metadata = {
  title: "Recommendation Reports",
  robots: { index: false, follow: false },
};

/**
 * NW07.6 — the student-facing release surface for the Counsellor Studio's
 * Recommendation Workflow. Deliberately NOT the same route as the existing
 * `/recommendations` page (the AI/engine-based career-matches surface) —
 * this is counsellor-authored, independently-reviewed guidance, a
 * distinct concept the brief asks never be conflated with an automated
 * match. Read-only: listMyRecommendationReports() returns ONLY reports
 * this student's own counsellor has released (get_my_recommendation_
 * reports() — a draft, submitted, or approved-but-not-yet-released report
 * never appears here, by construction of the RPC itself).
 */
export default async function RecommendationReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/studio/recommendation-reports");

  const reports = await listMyRecommendationReports();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/studio" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          Back to Studio
        </Link>
        <h1 className="text-2xl font-semibold text-primary sm:text-3xl">Recommendation Reports</h1>
        <p className="mt-2 text-base text-muted">
          Guidance your counsellor has prepared and an independent reviewer has approved for you, specifically.
        </p>
      </div>

      {reports.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <FileCheck2 aria-hidden="true" className="h-9 w-9 text-muted" />
          <h2 className="text-xl font-semibold text-primary">No reports yet</h2>
          <p className="max-w-sm text-sm text-muted">
            Once your counsellor finishes preparing a recommendation report and it&apos;s reviewed and released, it will
            show up here.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id}>
              <Link href={`/studio/recommendation-reports/${r.id}`}>
                <Card className="transition-colors hover:border-secondary/40">
                  <p className="font-medium text-text">{r.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {r.recommendationType ? `${r.recommendationType} · ` : ""}
                    Released {r.releasedAt ? new Date(r.releasedAt).toLocaleDateString("en-IN") : "recently"}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
