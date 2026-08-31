"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, Pencil, Trash2, Plus } from "lucide-react";
import { AdminTable, Td } from "@/components/admin/AdminTable";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { reorderPricingInclusionsAction, deletePricingInclusionAction } from "@/app/admin/pricing/actions";
import type { PricingInclusion } from "@/types/pricing";

/**
 * Lists a draft version's inclusions with reorder/edit/delete controls —
 * the admin capability "add, edit, remove and reorder inclusions" (spec).
 * Only ever rendered for a version whose status is "draft" (see
 * versions/[versionId]/page.tsx) — the database rejects every write below
 * against a non-draft parent regardless (0008 PART 1.1/1.2), so this
 * component is never even offered once a version is published.
 */
export function PricingInclusionsManager({ planId, versionId, inclusions }: { planId: string; versionId: string; inclusions: PricingInclusion[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const orderedIds = inclusions.map((i) => i.id);

  function move(inclusionId: string, direction: -1 | 1) {
    const index = orderedIds.indexOf(inclusionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= orderedIds.length) return;
    const next = [...orderedIds];
    [next[index], next[target]] = [next[target], next[index]];
    setError(null);
    setPendingId(inclusionId);
    startTransition(async () => {
      const result = await reorderPricingInclusionsAction(planId, versionId, next);
      setPendingId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}

      {inclusions.length === 0 ? (
        <p className="text-sm text-muted">No inclusions yet — add the first one below.</p>
      ) : (
        <AdminTable headers={["Order", "Title", "Category", "Highlight", "Active", ""]}>
          {inclusions.map((inclusion, index) => (
            <tr key={inclusion.id} className="hover:bg-surface-alt/50">
              <Td>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(inclusion.id, -1)}
                    disabled={index === 0 || pendingId !== null}
                    aria-label={`Move "${inclusion.title}" up`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] border border-border-strong text-text-soft hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(inclusion.id, 1)}
                    disabled={index === inclusions.length - 1 || pendingId !== null}
                    aria-label={`Move "${inclusion.title}" down`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] border border-border-strong text-text-soft hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Td>
              <Td className="font-medium text-text">
                {inclusion.title}
                {inclusion.explanation ? <p className="mt-0.5 text-xs text-muted">{inclusion.explanation}</p> : null}
              </Td>
              <Td className="text-text-soft">{inclusion.category ?? "—"}</Td>
              <Td>{inclusion.isHighlight ? <Badge tone="accent">Highlight</Badge> : null}</Td>
              <Td>{inclusion.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Hidden</Badge>}</Td>
              <Td>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/admin/pricing/${planId}/versions/${versionId}/inclusions/${inclusion.id}`}
                    aria-label={`Edit "${inclusion.title}"`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-secondary-dark hover:text-primary"
                  >
                    <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                  <form
                    action={async () => {
                      setError(null);
                      setPendingId(inclusion.id);
                      const result = await deletePricingInclusionAction(planId, versionId, inclusion.id, INITIAL_STATE);
                      setPendingId(null);
                      if (result?.error) {
                        setError(result.error);
                        return;
                      }
                      router.refresh();
                    }}
                  >
                    <DeleteButton title={inclusion.title} />
                  </form>
                </div>
              </Td>
            </tr>
          ))}
        </AdminTable>
      )}

      <LinkButton href={`/admin/pricing/${planId}/versions/${versionId}/inclusions/new`} size="sm" variant="outline" icon={<Plus aria-hidden="true" className="h-4 w-4" />}>
        Add inclusion
      </LinkButton>
    </div>
  );
}

const INITIAL_STATE = { error: null };

function DeleteButton({ title }: { title: string }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="submit"
      aria-label={armed ? `Confirm delete "${title}"` : `Delete "${title}"`}
      onClick={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
          setTimeout(() => setArmed(false), 4000);
        }
      }}
      className="inline-flex items-center gap-1 text-sm font-semibold text-error hover:text-error/80"
    >
      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
      {armed ? "Confirm delete" : "Delete"}
    </button>
  );
}
