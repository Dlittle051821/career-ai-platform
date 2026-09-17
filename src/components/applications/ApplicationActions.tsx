"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { STUDENT_APPLICATION_ACTIONS, getAvailableStudentActions } from "@/lib/applications/application-lifecycle";
import type { ApplicationStage, StudentApplicationAction } from "@/types/admin";
import { advanceApplicationAction } from "@/app/(site)/applications/actions";

/**
 * Milestone 16 — the student's own action buttons for one application.
 * `getAvailableStudentActions()` is the single source of truth for which
 * actions even render (never a raw stage string check duplicated here), so
 * this component can never offer an action the server-side RPC would
 * reject anyway. A "requiresConfirmation" action (submit, withdraw) uses an
 * inline, keyboard- and screen-reader-accessible confirm step — never a
 * native window.confirm() dialog (which blocks the whole page and reads
 * poorly to assistive tech) — mirroring the "arm, then confirm" shape of
 * src/components/admin/ConfirmSubmitButton.tsx without needing a real
 * <form> (this page calls a plain Server Action via useTransition, same
 * convention as SaveCourseButton.tsx).
 */
export function ApplicationActions({ applicationId, stage }: { applicationId: string; stage: ApplicationStage }) {
  const actions = getAvailableStudentActions(stage);
  const [armedAction, setArmedAction] = useState<StudentApplicationAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (actions.length === 0) return null;

  function handleClick(action: StudentApplicationAction) {
    const def = STUDENT_APPLICATION_ACTIONS[action];
    if (def.requiresConfirmation && armedAction !== action) {
      setArmedAction(action);
      setError(null);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await advanceApplicationAction(applicationId, action);
      setArmedAction(null);
      if (!result.success) {
        setError(result.error ?? "This application could not be updated. Please refresh and try again.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {actions.map((action) => {
          const def = STUDENT_APPLICATION_ACTIONS[action];
          const isArmed = armedAction === action;
          return (
            <Button
              key={action}
              type="button"
              variant={action === "withdraw" ? "destructive" : isArmed ? "destructive" : "primary"}
              onClick={() => handleClick(action)}
              disabled={isPending}
              aria-live="polite"
            >
              {isPending && armedAction === action ? "Saving…" : isArmed ? `Click again to confirm: ${def.buttonLabel}` : def.buttonLabel}
            </Button>
          );
        })}
        {armedAction ? (
          <Button type="button" variant="ghost" onClick={() => setArmedAction(null)} disabled={isPending}>
            Cancel
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
