"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toggleSaveCourseAction } from "@/app/(site)/courses/[universitySlug]/[courseSlug]/actions";

interface SaveCourseButtonProps {
  courseId: string;
  universitySlug: string;
  courseSlug: string;
  isLoggedIn: boolean;
  initialSaved: boolean;
}

/**
 * Course-page counterpart to SaveUniversityButton
 * (src/components/sections/education/SaveUniversityButton.tsx) — same
 * "plain log-in link when logged out, optimistic toggle with rollback on
 * failure when logged in" contract, just wired to the course entityType and
 * this route's own [universitySlug]/[courseSlug] actions. A near-identical
 * copy is intentional here (see that file's docblock and this task's own
 * spec) rather than a shared abstraction across two sibling agents' work.
 */
export function SaveCourseButton({ courseId, universitySlug, courseSlug, isLoggedIn, initialSaved }: SaveCourseButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isLoggedIn) {
    return (
      <Link
        href={`/login?next=/courses/${universitySlug}/${courseSlug}`}
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
      const result = await toggleSaveCourseAction(courseId, universitySlug, courseSlug, nextSaved);
      setSaved(result.saved);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div>
      <Button
        variant={saved ? "outline" : "primary"}
        onClick={handleClick}
        disabled={isPending}
        icon={saved ? <BookmarkCheck aria-hidden="true" className="h-4 w-4" /> : <Bookmark aria-hidden="true" className="h-4 w-4" />}
      >
        {isPending ? "Saving…" : saved ? "Saved" : "Save course"}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
