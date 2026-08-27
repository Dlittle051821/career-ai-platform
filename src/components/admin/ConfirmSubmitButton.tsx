"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A two-click confirmation submit button for destructive/high-impact
 * changes (revoking a role, deactivating a record, marking a payment
 * refunded) — deliberately not a native `confirm()` dialog, which is
 * jarring, blocks the whole page, and reads poorly to screen readers. The
 * first click turns the button into an explicit "Click to confirm" state
 * for a few seconds; a second click within that window submits, and
 * clicking away or waiting resets it. Also disables while the form is
 * actually submitting, same as SubmitButton.
 */
export function ConfirmSubmitButton({
  children,
  confirmLabel = "Click to confirm",
  savingLabel = "Saving…",
  className,
}: {
  children: React.ReactNode;
  confirmLabel?: string;
  savingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const [armed, setArmed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (armed) return; // second click: let the native submit proceed
    event.preventDefault();
    setArmed(true);
    timeoutRef.current = setTimeout(() => setArmed(false), 4000);
  }

  return (
    <button
      type="submit"
      onClick={handleClick}
      disabled={pending}
      aria-live="polite"
      className={cn(
        "inline-flex min-h-[40px] items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        armed ? "bg-error text-white hover:bg-error/90" : "border border-error/40 text-error hover:bg-error-light",
        className
      )}
    >
      {armed ? <AlertTriangle aria-hidden="true" className="h-4 w-4" /> : null}
      {pending ? savingLabel : armed ? confirmLabel : children}
    </button>
  );
}
