"use client";

import { useActionState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import { getAssignmentApprovalState } from "@/lib/discovery-sessions/assignment-approval";
import { formatDiscoverySessionDateTime } from "@/lib/discovery-sessions/format";
import type { DiscoverySession } from "@/types/discovery-session";

/**
 * CC-25 — admin-only card for the database-controlled approval of the
 * current counsellor assignment. The buttons call
 * admin_set_discovery_session_assignment_approval through a Server Action;
 * the database re-checks the admin role and refuses stale or invalid
 * decisions, so this card only offers what the admin may then confirm.
 */
export function AssignmentApprovalCard({
  action,
  session,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  session: DiscoverySession;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const approval = getAssignmentApprovalState(session);
  if (approval.kind === "unassigned") return null;

  const counsellor = session.assignedCounsellorName ?? "The assigned counsellor";
  const approved = approval.kind === "approved";
  const Icon = approved ? ShieldCheck : ShieldAlert;

  return (
    <Card as="section" className="mb-6">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${approved ? "bg-secondary-light text-secondary-dark" : "bg-surface-alt text-text-soft"}`}
        >
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-primary">
            Assignment approval
          </h2>
          {approval.kind === "approved" ? (
            <p className="mt-1 text-sm text-muted">
              Approved{approval.approvedAt ? ` on ${formatDiscoverySessionDateTime(approval.approvedAt)}` : ""}. {counsellor} can see the
              student&apos;s name and email while the session is requested or scheduled.
            </p>
          ) : null}
          {approval.kind === "awaiting_approval" ? (
            <p className="mt-1 text-sm text-muted">
              Not approved. {counsellor} can&apos;t see the student&apos;s details, open the workspace or change this session until an
              admin approves the assignment.
              {approval.canApprove ? "" : " Only a requested or scheduled session can be approved."}
            </p>
          ) : null}
          {approval.kind === "not_tracked" ? (
            <p className="mt-1 text-sm text-muted">
              Approvals start once the CC-25 database update is applied. Until then counsellors see &ldquo;Student details
              restricted&rdquo; for this session.
            </p>
          ) : null}

          {(approval.kind === "approved" || (approval.kind === "awaiting_approval" && approval.canApprove)) && session.assignedCounsellorId ? (
            <form action={formAction} className="mt-4 space-y-3">
              <FormError error={state.error} />
              <input type="hidden" name="counsellorId" value={session.assignedCounsellorId} />
              <input type="hidden" name="decision" value={approved ? "revoke" : "approve"} />
              <SubmitButton savingLabel={approved ? "Revoking…" : "Approving…"}>
                {approved ? "Revoke approval" : "Approve assignment"}
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
