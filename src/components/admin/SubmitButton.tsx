"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";

/**
 * A submit button that disables itself and shows "Saving…" while its
 * parent <form>'s action (a Server Action) is pending — satisfies "disable
 * buttons while saving" and "avoid accidental double submissions" without
 * any manual state wiring in every form. Must be rendered INSIDE the
 * <form> it belongs to; useFormStatus() reads the nearest parent form's
 * pending state, which works whether that form uses a plain server action
 * or React 19's useActionState (both render a real <form>).
 */
export function SubmitButton({ children, savingLabel = "Saving…" }: { children: React.ReactNode; savingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? savingLabel : children}
    </Button>
  );
}
