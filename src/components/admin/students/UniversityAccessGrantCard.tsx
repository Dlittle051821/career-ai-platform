"use client";

import { useActionState } from "react";
import { Input } from "@/components/forms/Input";
import { Textarea } from "@/components/forms/Textarea";
import { FormField } from "@/components/forms/FormField";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import type { UniversityAccessGrant } from "@/lib/supabase/admin/university-access-grants";

type Action = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

function when(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function GrantAccessForm({ action, studentUserId, studentName }: { action: Action; studentUserId: string; studentName: string }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-3">
      <FormError error={state.error} />
      <input type="hidden" name="confirmStudentId" value={studentUserId} />
      <p className="text-sm text-text-soft">
        Grants <strong>{studentName}</strong> the Verified university directory only: profiles and the shortlist. It does not grant course records, an admin role or any other plan benefit.
      </p>
      <FormField id="grant-reason" label="Reason" hint="Required. Stored with your name and the time in the audit log.">
        <Textarea id="grant-reason" name="reason" rows={3} required minLength={5} maxLength={500} placeholder="e.g. Paid offline on 14 Nov, receipt NW-0193" />
      </FormField>
      <FormField id="grant-expires" label="Expires on (optional)" hint="Leave empty for no expiry. Access ends at the end of this day.">
        <Input id="grant-expires" name="expiresOn" type="date" />
      </FormField>
      <SubmitButton>Grant Verified university access</SubmitButton>
    </form>
  );
}

export function RevokeAccessForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="mt-3 space-y-3 border-t border-border pt-3">
      <FormError error={state.error} />
      <FormField id="revoke-reason" label="Reason for revoking" hint="Required. The student loses directory access immediately; their saved list is kept.">
        <Textarea id="revoke-reason" name="revokeReason" rows={2} required minLength={5} maxLength={500} />
      </FormField>
      <SubmitButton>Revoke access</SubmitButton>
    </form>
  );
}

export function GrantHistory({ grants }: { grants: UniversityAccessGrant[] }) {
  if (grants.length === 0) return <p className="text-sm text-muted">No grant has been issued for this student.</p>;
  return (
    <ul className="space-y-3">
      {grants.map((grant) => (
        <li key={grant.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={grant.status} />
            <span className="text-sm text-text-soft">Granted {when(grant.grantedAt)} by {grant.grantedByName ?? "a removed account"}</span>
          </div>
          <p className="mt-1 text-sm text-text">{grant.reason}</p>
          <p className="mt-1 text-xs text-muted">
            Scope: university directory · {grant.expiresAt ? `Expires ${when(grant.expiresAt)}` : "No expiry"}
            {grant.revokedAt ? ` · Revoked ${when(grant.revokedAt)} by ${grant.revokedByName ?? "a removed account"}: ${grant.revokeReason}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
