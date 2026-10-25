import { getApplicationBucket, type ApplicationBucket, type ResolvedApplicationDeadline } from "./application-lifecycle";
import type { ApplicationStage } from "@/types/admin";

/**
 * NW06.2 — Abroad Application Dashboard (/studio/abroad/applications).
 * Pure, framework-free composition logic — no Supabase import, same split
 * as every other src/lib/applications/ module. This dashboard introduces
 * no new read: every input here is built in the page component from data
 * already fetched by listMyApplications() (Milestone 16) and
 * getMyApplicationHistory() (Milestone 16) — this module only sorts/limits/
 * labels that data for the two new panels (upcoming deadlines, recent
 * activity) the dashboard adds on top of the existing bucket-grouped list.
 */

export interface UpcomingDeadlineInput {
  applicationId: string;
  label: string;
  stage: ApplicationStage;
  deadline: ResolvedApplicationDeadline;
}

export interface UpcomingDeadlineItem extends UpcomingDeadlineInput {
  bucket: ApplicationBucket;
  isOverdue: boolean;
}

/**
 * The soonest real deadlines across the student's own Abroad applications —
 * only ones with an `isAbroadDestinationName()`-filtered, resolveApplicationDeadline()`-resolved
 * real deadline (never a guessed date), excluding the `closed` bucket
 * (enrolled/rejected/withdrawn applications have no deadline left to act
 * on). Sorted soonest-first — an already-passed deadline on an otherwise
 * still-active application sorts first too (flagged `isOverdue`, never
 * silently hidden), since that is the single most urgent thing for a
 * student to see.
 */
export function getUpcomingApplicationDeadlines(
  inputs: readonly UpcomingDeadlineInput[],
  now: Date = new Date(),
  limit = 5
): UpcomingDeadlineItem[] {
  return inputs
    .map((input) => ({ ...input, bucket: getApplicationBucket(input.stage), isOverdue: new Date(input.deadline.date).getTime() < now.getTime() }))
    .filter((item) => item.bucket !== "closed")
    .sort((a, b) => new Date(a.deadline.date).getTime() - new Date(b.deadline.date).getTime())
    .slice(0, limit);
}

export interface RecentApplicationActivityInput {
  id: string;
  applicationId: string;
  applicationLabel: string;
  message: string;
  createdAt: string;
}

/**
 * Merges each Abroad application's own stage-history entries (already
 * fetched per application via getMyApplicationHistory() — this introduces
 * no new query or table) into one newest-first feed across all of them,
 * capped at `limit`. Purely a sort+truncate — every entry's own message/
 * timestamp is carried through unchanged, never reworded or re-dated.
 */
export function mergeRecentApplicationActivity(inputs: readonly RecentApplicationActivityInput[], limit = 8): RecentApplicationActivityInput[] {
  return [...inputs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
}
