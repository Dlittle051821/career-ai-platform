import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/supabase/profile";
import { getMyRecommendationReportContent } from "@/lib/supabase/education/recommendation-reports";
import type { RecommendationDraftContent } from "@/lib/recommendations/drafts";

interface RecommendationReportPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Recommendation Report",
  robots: { index: false, follow: false },
};

const CONTENT_FIELD_LABELS: Record<keyof RecommendationDraftContent, string> = {
  summary: "Summary",
  careerGuidance: "Career guidance",
  courseGuidance: "Course guidance",
  collegeGuidance: "College guidance",
  pathwayGuidance: "Pathway guidance",
  counsellorRationale: "Counsellor rationale",
};

/**
 * NW07.6 — one of the student's own released recommendation reports.
 * getMyRecommendationReportContent() returns `null` for a report that
 * isn't theirs, isn't released yet, or doesn't exist — deliberately
 * indistinguishable (anti-enumeration), so this page renders the exact
 * same honest 404 for all three rather than leaking which case applies.
 */
export default async function RecommendationReportPage({ params }: RecommendationReportPageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/studio/recommendation-reports/${id}`);

  const report = await getMyRecommendationReportContent(id);
  if (!report) notFound();

  const contentEntries = (Object.keys(CONTENT_FIELD_LABELS) as (keyof RecommendationDraftContent)[]).filter((key) => report.content[key]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/studio/recommendation-reports" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          Back to Recommendation Reports
        </Link>
        <h1 className="text-2xl font-semibold text-primary sm:text-3xl">{report.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {report.recommendationType ? `${report.recommendationType} · ` : ""}
          Released {report.releasedAt ? new Date(report.releasedAt).toLocaleDateString("en-IN") : "recently"}
        </p>
      </div>

      <Card className="border-info/25 bg-info-light">
        <p className="text-sm text-info">
          This is your counsellor&apos;s own professional guidance, independently reviewed before being shared with you —
          not an automated match, and never a guarantee of admission to any course or university.
        </p>
      </Card>

      {contentEntries.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">This report doesn&apos;t have any content yet.</p>
        </Card>
      ) : (
        <Card>
          <dl className="space-y-5">
            {contentEntries.map((key) => (
              <div key={key}>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">{CONTENT_FIELD_LABELS[key]}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-text">{report.content[key]}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </div>
  );
}
