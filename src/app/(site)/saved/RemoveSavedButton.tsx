"use client";

import { useFormStatus } from "react-dom";
import { X } from "lucide-react";

/**
 * Small "Remove" submit button for one saved-item row. Must be rendered
 * inside the <form action={removeSavedItemAction.bind(null, ...)}> it
 * belongs to — useFormStatus() reads that nearest parent form's pending
 * state, same convention as src/components/admin/SubmitButton.tsx, kept as
 * its own small client component here rather than importing the admin one
 * into a student-facing page.
 */
export function RemoveSavedButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--radius-control)] border border-border-strong px-3 py-1.5 text-xs font-medium text-text-soft transition-colors hover:bg-surface-alt hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
    >
      <X aria-hidden="true" className="h-3.5 w-3.5" />
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
