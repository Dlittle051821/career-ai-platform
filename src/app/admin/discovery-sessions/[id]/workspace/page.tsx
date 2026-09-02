import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { DiscoverySessionWorkspaceForm } from "@/components/admin/discovery-sessions/DiscoverySessionWorkspaceForm";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getDiscoverySessionById } from "@/lib/supabase/admin/discovery-sessions";
import { getDiscoverySessionWorkspace } from "@/lib/supabase/admin/discovery-session-workspace";
import { DISCOVERY_SESSION_STATUS_LABELS } from "@/types/discovery-session";
import { saveDiscoverySessionWorkspaceAction } from "./actions";

interface WorkspacePageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Discovery Session Workspace" };

export default async function DiscoverySessionWorkspacePage({ params }: WorkspacePageProps) {
  const { id } = await params;
  const [session, workspace] = await Promise.all([getDiscoverySessionById(id), getDiscoverySessionWorkspace(id)]);
  if (!session) notFound();

  const boundAction = saveDiscoverySessionWorkspaceAction.bind(null, id);

  return (
    <div className="max-w-4xl">
      <Link href={`/admin/discovery-sessions/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-secondary-dark hover:text-primary">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Back to Discovery Session
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Counsellor Workspace</p>
          <h1 className="mt-2 text-2xl font-semibold text-primary sm:text-3xl">{session.studentName ?? "Unnamed student"}</h1>
          <p className="mt-2 text-sm text-muted">
            {workspace ? `Last updated ${new Date(workspace.updatedAt).toLocaleString("en-IN")}` : "Not started yet — save any section to begin."}
          </p>
        </div>
        <StatusBadge status={session.status} labelOverride={DISCOVERY_SESSION_STATUS_LABELS[session.status]} />
      </div>

      {session.status === "cancelled" ? (
        <p className="rounded-[var(--radius-control)] border border-warning/25 bg-warning-light px-4 py-3 text-sm text-warning">
          This Discovery Session is cancelled — the workspace is read-only.
        </p>
      ) : (
        <DiscoverySessionWorkspaceForm action={boundAction} workspace={workspace} />
      )}
    </div>
  );
}
