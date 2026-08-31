"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toggleSaveUniversityAction } from "@/app/(site)/universities/[slug]/actions";

interface SaveUniversityButtonProps {
  universityId: string;
  slug: string;
  isLoggedIn: boolean;
  initialSaved: boolean;
}

/**
 * For a logged-out visitor this renders a plain "Log in to save" link (per
 * spec — never a fake/disabled toggle) that carries `next` back to this
 * exact page. For a logged-in visitor it's an optimistic toggle backed by
 * toggleSaveUniversityAction; on failure it rolls back to the previous
 * state and shows the server's error message rather than leaving the UI
 * silently wrong.
 */
export function SaveUniversityButton({ universityId, slug, isLoggedIn, initialSaved }: SaveUniversityButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isLoggedIn) {
    return (
      <Link
        href={`/login?next=/universities/${slug}`}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-control)] border border-border-strong px-5 py-3 text-[15px] font-medium text-primary transition-colors hover:bg-surface-alt"
      >
        <Bookmark aria-hidden="true" className="h-4 w-4" />
        Log in to save
      </Link>
    );
  }

  function handleClick() {
    const nextSaved = !saved;
    setSaved(nextSaved);
    setError(null);
    startTransition(async () => {
      const result = await toggleSaveUniversityAction(universityId, slug, nextSaved);
      setSaved(result.saved);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div>
      <Button variant={saved ? "outline" : "primary"} onClick={handleClick} disabled={isPending} icon={saved ? <BookmarkCheck aria-hidden="true" className="h-4 w-4" /> : <Bookmark aria-hidden="true" className="h-4 w-4" />}>
        {isPending ? "Saving…" : saved ? "Saved" : "Save university"}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
