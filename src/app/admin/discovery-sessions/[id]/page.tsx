import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, NotebookPen } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DiscoverySessionActionForm } from "@/components/admin/discovery-sessions/DiscoverySessionActionForm";
import { getDiscoverySessionById } from "@/lib/supabase/admin/discovery-sessions";
import { getDiscoverySessionWorkspace } from "@/lib/supabase/admin/discovery-session-workspace";
import { listCounsellorOptions } from "@/lib/supabase/admin/counsellors";
import { DISCOVERY_SESSION_STATUS_LABELS } from "@/types/discovery-session";
import { updateDiscoverySessionAction } from "../actions";

interface DiscoverySessionDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Discovery Session" };

export default async function DiscoverySessionDetailPage({ params }: DiscoverySessionDetailPageProps) {
  const { id } = await params;
  const [session, counsellorOptions, workspace] = await Promise.all([
    getDiscoverySessionById(id),
    listCounsellorOptions(),
    getDiscoverySessionWorkspace(id),
  ]);
  if (!session) notFound();

  const boundAction = updateDiscoverySessionAction.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/discovery-sessions" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to Discovery Sessions
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Discovery Session</p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{session.studentName ?? "Unnamed student"}</h1>
          <p className="mt-2 text-sm text-muted">
            {session.studentEmail ?? "No email on file"} · Requested {new Date(session.createdAt).toLocaleString("en-IN")}
          </p>
        </div>
        <StatusBadge status={session.status} labelOverride={DISCOVERY_SESSION_STATUS_LABELS[session.status]} />
      </div>

      <Card className="mb-6">
        <h2 className="text-base font-semibold text-primary">Booking preferences</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Preferred contact</dt>
            <dd className="mt-0.5 text-text">{session.preferredContactMethod ?? "No preference"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Preferred time</dt>
            <dd className="mt-0.5 text-text">{session.preferredTimeRange ?? "No preference"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Preferred language</dt>
            <dd className="mt-0.5 text-text">{session.preferredLanguage ?? "Not specified"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Student</dt>
            <dd className="mt-0.5">
              <Link href={`/admin/students/${session.studentUserId}`} className="font-semibold text-secondary-dark hover:text-primary">
                View student record
              </Link>
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
            <NotebookPen aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-primary">Counsellor Workspace</h2>
            <p className="mt-1 text-sm text-muted">
              {workspace ? `Started — last updated ${new Date(workspace.updatedAt).toLocaleString("en-IN")}.` : "Not started yet — sections A-J."}
            </p>
          </div>
        </div>
        <LinkButton href={`/admin/discovery-sessions/${id}/workspace`} size="sm" variant="outline">
          {workspace ? "Open workspace" : "Start workspace"}
        </LinkButton>
      </Card>

      <DiscoverySessionActionForm action={boundAction} session={session} counsellorOptions={counsellorOptions} />
    </div>
  );
}
