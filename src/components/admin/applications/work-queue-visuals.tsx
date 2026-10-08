import { AlertCircle, CheckCircle2, ClipboardList, Hourglass, Send } from "lucide-react";
import type { WorkQueueBucket } from "@/lib/applications/application-work-queue";

/**
 * UX09 — the ONE shared bucket -> (Badge tone, icon, icon color) mapping,
 * imported by the applications list, the application detail page, and the
 * admin dashboard widget. Having three surfaces import three separate copies
 * of this mapping is exactly how "needs attention" quietly drifts into
 * meaning three different things — this file exists so that can't happen.
 *
 * Tone values are the SAME `Badge` tone vocabulary already used everywhere
 * else in the admin (StatusBadge, etc.) — no new color system, no new Badge
 * variant. Every badge that uses this tone still renders its own text label
 * (WORK_QUEUE_BUCKET_LABELS) — status is never communicated by color alone.
 */

export const WORK_QUEUE_BUCKET_TONE: Record<WorkQueueBucket, "neutral" | "success" | "warning" | "error" | "info" | "accent"> = {
  needs_action: "warning",
  waiting_on_student: "accent",
  ready_for_submission: "success",
  awaiting_university: "info",
  no_action: "neutral",
  closed: "neutral",
};

export const WORK_QUEUE_BUCKET_ICON: Record<WorkQueueBucket, typeof AlertCircle> = {
  needs_action: AlertCircle,
  waiting_on_student: Hourglass,
  ready_for_submission: Send,
  awaiting_university: ClipboardList,
  no_action: CheckCircle2,
  closed: CheckCircle2,
};

export const WORK_QUEUE_BUCKET_ICON_CLASS: Record<WorkQueueBucket, string> = {
  needs_action: "text-warning",
  waiting_on_student: "text-accent-dark",
  ready_for_submission: "text-success",
  awaiting_university: "text-info",
  no_action: "text-muted",
  closed: "text-muted",
};
