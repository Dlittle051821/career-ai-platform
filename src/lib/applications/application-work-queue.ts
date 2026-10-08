import type { NextOperationalActionKind } from "./next-operational-action";

/**
 * Milestone 19 UX (UX09) — a small, pure re-grouping of every
 * `NextOperationalActionKind` (Milestone 18, extended by Milestone 19) into
 * the handful of buckets a counsellor actually scans a work queue by: "what
 * needs ME to act", "what needs the STUDENT to act", "what's ready to move
 * forward", and so on. Deliberately NOT a second rules engine — this module
 * never re-derives `getNextOperationalAction()`'s own logic, it only
 * re-labels its already-computed output for presentation. Every list/detail/
 * dashboard surface that wants to group applications by urgency imports this
 * SAME module, so "needs attention" can never mean something different on
 * the applications list than it means on the dashboard widget.
 *
 * Framework-free, same "pure logic in src/lib/applications/" convention as
 * next-operational-action.ts itself.
 */

export type WorkQueueBucket =
  | "needs_action"
  | "waiting_on_student"
  | "ready_for_submission"
  | "awaiting_university"
  | "no_action"
  | "closed";

export const WORK_QUEUE_BUCKET_ORDER: readonly WorkQueueBucket[] = [
  "needs_action",
  "waiting_on_student",
  "ready_for_submission",
  "awaiting_university",
  "no_action",
  "closed",
];

export const WORK_QUEUE_BUCKET_LABELS: Record<WorkQueueBucket, string> = {
  needs_action: "Needs action",
  waiting_on_student: "Waiting on student",
  ready_for_submission: "Ready for external submission",
  awaiting_university: "Awaiting university",
  no_action: "No immediate action",
  closed: "Closed",
};

/**
 * Exhaustive by construction: `Record<NextOperationalActionKind, ...>` means
 * adding a new `NextOperationalActionKind` without adding it here is a
 * TypeScript compile error, not a silently-wrong bucket at runtime.
 */
const BUCKET_BY_ACTION_KIND: Record<NextOperationalActionKind, WorkQueueBucket> = {
  closed: "closed",
  review_documents: "needs_action",
  request_missing_documents: "needs_action",
  complete_checklist_item: "needs_action",
  add_application_reference: "needs_action",
  waiting_on_student: "waiting_on_student",
  ready_for_submission: "ready_for_submission",
  await_university_acknowledgement: "awaiting_university",
  no_action: "no_action",
};

export function getWorkQueueBucket(kind: NextOperationalActionKind): WorkQueueBucket {
  return BUCKET_BY_ACTION_KIND[kind];
}

export interface WorkQueueSummary {
  bucket: WorkQueueBucket;
  count: number;
}

/**
 * Tallies a list of action kinds into bucket counts, in the fixed display
 * order above, omitting any bucket with zero items so a summary bar never
 * shows five empty "0" pills.
 */
export function getWorkQueueSummary(kinds: readonly NextOperationalActionKind[]): WorkQueueSummary[] {
  const counts = new Map<WorkQueueBucket, number>();
  for (const kind of kinds) {
    const bucket = getWorkQueueBucket(kind);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return WORK_QUEUE_BUCKET_ORDER.filter((b) => (counts.get(b) ?? 0) > 0).map((bucket) => ({ bucket, count: counts.get(bucket) ?? 0 }));
}

/**
 * Stable sort by bucket priority (WORK_QUEUE_BUCKET_ORDER), preserving the
 * caller's own relative order within each bucket (e.g. "most recently
 * updated first", already applied by the caller's query) rather than
 * re-sorting within a bucket itself.
 */
export function sortByWorkQueueBucket<T>(items: readonly T[], bucketOf: (item: T) => WorkQueueBucket): T[] {
  const rank = new Map(WORK_QUEUE_BUCKET_ORDER.map((b, i) => [b, i]));
  return items
    .map((item, index) => ({ item, index, rank: rank.get(bucketOf(item)) ?? WORK_QUEUE_BUCKET_ORDER.length }))
    .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.index - b.index))
    .map((entry) => entry.item);
}
