import { AlertCircle } from "lucide-react";

/** Renders a Server Action's returned error message — see src/lib/admin/form-state.ts. */
export function FormError({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex items-center gap-2 rounded-[var(--radius-control)] border border-error/25 bg-error-light px-3.5 py-2.5 text-sm text-error">
      <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
      {error}
    </p>
  );
}
