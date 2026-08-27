import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LeadForm } from "@/components/admin/leads/LeadForm";
import { ConvertLeadForm } from "@/components/admin/leads/ConvertLeadForm";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getLeadById } from "@/lib/supabase/admin/leads";
import { listCounsellorOptions } from "@/lib/supabase/admin/counsellors";
import { LEAD_STAGE_LABELS } from "@/types/admin";
import { updateLeadAction, convertLeadAction } from "../actions";

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Edit Lead" };

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params;
  const [lead, counsellorOptions] = await Promise.all([getLeadById(id), listCounsellorOptions()]);
  if (!lead) notFound();

  const boundUpdateAction = updateLeadAction.bind(null, id);
  const boundConvertAction = convertLeadAction.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/leads" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to leads
      </Link>
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Leads</p>
        <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{lead.fullName}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {new Date(lead.updatedAt).toLocaleString("en-IN")}</p>
      </div>

      <LeadForm action={boundUpdateAction} defaultValues={lead} counsellorOptions={counsellorOptions} submitLabel="Save changes" />

      {lead.stage !== "converted" ? (
        <Card className="mt-6">
          <h2 className="text-base font-semibold text-primary">Convert to student</h2>
          <p className="mt-1 text-sm text-muted">Only usable once this person has actually registered a student account.</p>
          <div className="mt-3">
            <ConvertLeadForm action={boundConvertAction} />
          </div>
        </Card>
      ) : lead.convertedStudentUserId ? (
        <Card className="mt-6">
          <h2 className="text-base font-semibold text-primary">Converted</h2>
          <p className="mt-1 text-sm text-muted">
            Linked to{" "}
            <Link href={`/admin/students/${lead.convertedStudentUserId}`} className="font-semibold text-secondary-dark hover:text-primary">
              this student&apos;s record
            </Link>
            .
          </p>
        </Card>
      ) : null}

      <Card className="mt-6">
        <h2 className="text-base font-semibold text-primary">Stage history</h2>
        {lead.statusHistory.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No stage changes recorded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {lead.statusHistory.map((h) => (
              <li key={h.id} className="flex items-center justify-between border-t border-border pt-2 text-sm first:border-0 first:pt-0">
                <span className="flex items-center gap-2 text-text-soft">
                  {h.fromStage ? <StatusBadge status={h.fromStage} labelOverride={LEAD_STAGE_LABELS[h.fromStage]} /> : <span className="text-muted">—</span>}
                  →
                  <StatusBadge status={h.toStage} labelOverride={LEAD_STAGE_LABELS[h.toStage]} />
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
