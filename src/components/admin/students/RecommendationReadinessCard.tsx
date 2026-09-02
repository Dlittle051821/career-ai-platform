"use client";

import { useActionState, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/forms/Textarea";
import { FormField } from "@/components/forms/FormField";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { FormError } from "@/components/admin/FormError";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import { PROFILE_SECTION_LABELS, type ProfileSectionKey } from "@/types/profile-provenance";
import {
  RECOMMENDATION_TYPES,
  RECOMMENDATION_TYPE_LABELS,
  RECOMMENDATION_TYPE_HAS_ENGINE,
  RECOMMENDATION_CONFIDENCE_LABELS,
  type RecommendationReadiness,
  type RecommendationType,
} from "@/types/recommendation-readiness";

type Action = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Milestone 11-C2 — one row per recommendation type (career/course/college/
 * pathway), each computed fresh from the Student Digital Profile (see
 * src/lib/recommendations/readiness.ts) with an optional counsellor
 * verification layered on top. course/college/pathway have no matching
 * engine yet — shown here as forward-looking readiness tracking, not a
 * promise of recommendations that don't exist (see RECOMMENDATION_TYPE_HAS_ENGINE).
 */
export function RecommendationReadinessCard({
  readiness,
  canWrite,
  hasCounsellorId,
  setAction,
  clearAction,
}: {
  readiness: Record<RecommendationType, RecommendationReadiness>;
  canWrite: boolean;
  hasCounsellorId: boolean;
  setAction: Action;
  clearAction: Action;
}) {
  return (
    <Card className="mb-6">
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden="true" className="h-4 w-4 text-secondary-dark" />
        <h2 className="text-base font-semibold text-primary">Recommendation readiness</h2>
      </div>
      <p className="mt-1 text-xs text-muted">
        Whether this student&apos;s profile has enough data for each kind of recommendation — computed fresh from
        their Student Digital Profile, not a stored value. A counsellor can verify a type explicitly, which always
        overrides the computed level.
      </p>

      <ul className="mt-4 divide-y divide-border">
        {RECOMMENDATION_TYPES.map((type) => (
          <TypeRow
            key={`${type}:${readiness[type].verifiedAt ?? "computed"}`}
            type={type}
            item={readiness[type]}
            canWrite={canWrite}
            hasCounsellorId={hasCounsellorId}
            setAction={setAction}
            clearAction={clearAction}
          />
        ))}
      </ul>
    </Card>
  );
}

function TypeRow({
  type,
  item,
  canWrite,
  hasCounsellorId,
  setAction,
  clearAction,
}: {
  type: RecommendationType;
  item: RecommendationReadiness;
  canWrite: boolean;
  hasCounsellorId: boolean;
  setAction: Action;
  clearAction: Action;
}) {
  const [editing, setEditing] = useState(false);
  const [setState, setFormAction] = useActionState(setAction, INITIAL_ACTION_STATE);
  const [clearState, clearFormAction] = useActionState(clearAction, INITIAL_ACTION_STATE);
  const hasEngine = RECOMMENDATION_TYPE_HAS_ENGINE[type];
  const isVerified = item.level === "COUNSELLOR_VERIFIED";

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-text">
            {RECOMMENDATION_TYPE_LABELS[type]}
            {!hasEngine && <span className="ml-1.5 text-xs font-normal text-muted">(matching engine not built yet)</span>}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {item.relevantCompletionPercent}% of relevant profile data · {RECOMMENDATION_CONFIDENCE_LABELS[item.confidence]}
            {isVerified && item.verifiedByCounsellorName
              ? ` · Verified by ${item.verifiedByCounsellorName}${item.verifiedAt ? ` on ${new Date(item.verifiedAt).toLocaleDateString("en-IN")}` : ""}`
              : ""}
          </p>
          {item.missingSectionKeys.length > 0 && (
            <p className="mt-0.5 text-xs text-muted">
              Missing: {item.missingSectionKeys.map((key) => PROFILE_SECTION_LABELS[key as ProfileSectionKey] ?? key).join(", ")}
            </p>
          )}
          {item.note && <p className="mt-0.5 text-xs italic text-muted">&quot;{item.note}&quot;</p>}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={item.level.toLowerCase()} labelOverride={item.level === "COUNSELLOR_VERIFIED" ? "Verified" : undefined} />
          {canWrite && !isVerified && !editing && hasCounsellorId && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Verify
            </Button>
          )}
        </div>
      </div>

      {canWrite && isVerified && (
        <form action={clearFormAction} className="mt-2">
          <input type="hidden" name="recommendationType" value={type} />
          <FormError error={clearState.error} />
          <ConfirmSubmitButton className="mt-1">Clear verification</ConfirmSubmitButton>
        </form>
      )}

      {canWrite && !isVerified && !hasCounsellorId && (
        <p className="mt-2 text-xs text-muted">Only a linked counsellor account can verify recommendation readiness.</p>
      )}

      {canWrite && !isVerified && editing && hasCounsellorId && (
        <form action={setFormAction} className="mt-3 space-y-3 rounded-[var(--radius-control)] border border-border bg-surface-alt p-3.5">
          <input type="hidden" name="recommendationType" value={type} />
          <FormError error={setState.error} />
          <FormField id={`note-${type}`} label="Note" hint="Shown to other staff only, never to the student.">
            <Textarea id={`note-${type}`} name="note" rows={2} />
          </FormField>
          <div className="flex items-center gap-2">
            <SubmitButton>Verify {RECOMMENDATION_TYPE_LABELS[type].toLowerCase()} readiness</SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

