"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { getAdminApplicationDocumentDownloadUrlAction } from "@/app/admin/applications/actions";

/**
 * Milestone 17 (v2) — read-only "View" button for the admin/counsellor
 * Documents card on /admin/applications/[id]. Deliberately the ONLY control
 * this milestone adds to that page — no upload/replace/remove anywhere in
 * admin, per this milestone's "keep admin changes minimal, no M18 review
 * workflow" scope.
 */
export function AdminDocumentDownloadButton({ storagePath }: { storagePath: string }) {
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(false);
    startTransition(async () => {
      const { url } = await getAdminApplicationDocumentDownloadUrlAction(storagePath);
      if (!url) {
        setError(true);
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant="outline" onClick={handleClick} disabled={isPending}>
        {isPending ? "Opening…" : "View"}
      </Button>
      {error ? <p className="text-xs text-error">Not available right now.</p> : null}
    </div>
  );
}
