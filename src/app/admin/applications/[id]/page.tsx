import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ApplicationForm } from "@/components/admin/applications/ApplicationForm";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getApplicationById } from "@/lib/supabase/admin/applications";
import { listUniversityOptions } from "@/lib/supabase/admin/universities";
import { listCourseOptions } from "@/lib/supabase/admin/courses";
import { listCounsellorOptions } from "@/lib/supabase/admin/counsellors";
import { APPLICATION_STAGE_LABELS } from "@/types/admin";
import { updateApplicationAction } from "../actions";

interface ApplicationDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Edit Application" };

export default async function ApplicationDetailPage({ params }: ApplicationDetailPageProps) {
  const { id } = await params;
  const [application, universityOptions, courseOptions, counsellorOptions] = await Promise.all([
    getApplicationById(id),
    listUniversityOptions(),
    listCourseOptions(),
    listCounsellorOptions(),
  ]);
  if (!application) notFound();

  const boundAction = updateApplicationAction.bind(null, id, application.studentUserId);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/applications" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to applications
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Applications</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">
          {application.studentName ?? "Unnamed student"}
          {application.universityName ? ` — ${application.universityName}` : ""}
        </h1>
        <p className="mt-2 text-sm text-muted">Last updated {new Date(application.updatedAt).toLocaleString("en-IN")}</p>
      </div>

      <ApplicationForm
        action={boundAction}
        defaultValues={application}
        universityOptions={universityOptions}
        courseOptions={courseOptions}
        counsellorOptions={counsellorOptions}
        submitLabel="Save changes"
      />

      <Card className="mt-6">
        <h2 className="text-base font-semibold text-primary">Stage history</h2>
        {application.statusHistory.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No stage changes recorded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {application.statusHistory.map((h) => (
              <li key={h.id} className="flex items-center justify-between border-t border-border pt-2 text-sm first:border-0 first:pt-0">
                <span className="flex items-center gap-2 text-text-soft">
                  {h.fromStatus ? (
                    <StatusBadge status={h.fromStatus} labelOverride={APPLICATION_STAGE_LABELS[h.fromStatus as keyof typeof APPLICATION_STAGE_LABELS] ?? h.fromStatus} />
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                  →
                  <StatusBadge status={h.toStatus} labelOverride={APPLICATION_STAGE_LABELS[h.toStatus as keyof typeof APPLICATION_STAGE_LABELS] ?? h.toStatus} />
                </span>
                <span className="text-xs text-muted">{new Date(h.createdAt).toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
