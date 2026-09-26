"use client";

import { useState, useTransition } from "react";
import { Checkbox } from "@/components/forms/Checkbox";
import { Badge } from "@/components/ui/Badge";
import { toggleApplicationChecklistItemAction } from "@/app/admin/applications/actions";
import type { ChecklistItemView } from "@/lib/applications/application-checklist";

/**
 * Milestone 18 — operational checklist. Manual items (kind: 'manual') are
 * checkboxes wired to toggleApplicationChecklistItemAction(); derived items
 * (kind: 'derived') render as read-only status badges — they can never be
 * checked directly, since they are computed from other signals (document
 * completeness/review/readiness), not stored state.
 */
export function AdminApplicationChecklist({ applicationId, items }: { applicationId: string; items: ChecklistItemView[] }) {
  const [localItems, setLocalItems] = useState(items);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle(key: string, next: boolean) {
    setError(null);
    setLocalItems((prev) => prev.map((i) => (i.key === key ? { ...i, status: next ? "complete" : "pending" } : i)));
    startTransition(async () => {
      const result = await toggleApplicationChecklistItemAction(applicationId, key, next);
      if (!result.success) {
        setError(result.error ?? "We couldn't update this checklist item. Please try again.");
        setLocalItems((prev) => prev.map((i) => (i.key === key ? { ...i, status: next ? "pending" : "complete" } : i)));
      }
    });
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {localItems.map((item) =>
          item.kind === "manual" ? (
            <li key={item.key}>
              <Checkbox
                id={`checklist-${item.key}`}
                label={item.label}
                checked={item.status === "complete"}
                disabled={isPending}
                onChange={(e) => handleToggle(item.key, e.target.checked)}
              />
            </li>
          ) : (
            <li key={item.key} className="flex items-center justify-between gap-3 border-t border-border pt-2 text-sm first:border-0 first:pt-0">
              <span className="text-text-soft">{item.label}</span>
              <Badge tone={item.status === "complete" ? "success" : item.status === "action_required" ? "warning" : "neutral"}>
                {item.status === "complete" ? "Complete" : item.status === "action_required" ? "Action required" : "Pending"}
              </Badge>
            </li>
          )
        )}
      </ul>
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
