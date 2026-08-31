"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleIntakeInterestAction } from "@/app/(site)/courses/[universitySlug]/[courseSlug]/actions";

interface IntakeTrackerProps {
  courseIntakeId: string;
  universitySlug: string;
  courseSlug: string;
  isLoggedIn: boolean;
  initialInterested: boolean;
}

/** Small inline "track this intake" toggle rendered next to one course_intakes row. Same optimistic-toggle-with-rollback shape as SaveCourseButton, scaled down to an inline pill button. */
export function IntakeTracker({ courseIntakeId, universitySlug, courseSlug, isLoggedIn, initialInterested }: IntakeTrackerProps) {
  const [interested, setInterested] = useState(initialInterested);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isLoggedIn) {
    return (
      <Link href={`/login?next=/courses/${universitySlug}/${courseSlug}`} className="text-xs font-semibold text-secondary-dark hover:text-primary">
        Log in to track
      </Link>
    );
  }

  function handleClick() {
    const next = !interested;
    setInterested(next);
    setError(null);
    startTransition(async () => {
      const result = await toggleIntakeInterestAction(courseIntakeId, universitySlug, courseSlug, next);
      setInterested(result.interested);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60",
          interested ? "border-accent/25 bg-accent-light text-accent-dark" : "border-border-strong text-text-soft hover:bg-surface-alt",
        )}
      >
        {interested ? <BellRing aria-hidden="true" className="h-3.5 w-3.5" /> : <Bell aria-hidden="true" className="h-3.5 w-3.5" />}
        {isPending ? "…" : interested ? "Tracking" : "Track intake"}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
