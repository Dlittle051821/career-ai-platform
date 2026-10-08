import { describe, expect, it } from "vitest";
import type { NextOperationalActionKind } from "./next-operational-action";
import {
  WORK_QUEUE_BUCKET_LABELS,
  WORK_QUEUE_BUCKET_ORDER,
  getWorkQueueBucket,
  getWorkQueueSummary,
  sortByWorkQueueBucket,
  type WorkQueueBucket,
} from "./application-work-queue";

const ALL_KINDS: NextOperationalActionKind[] = [
  "closed",
  "review_documents",
  "request_missing_documents",
  "waiting_on_student",
  "complete_checklist_item",
  "ready_for_submission",
  "add_application_reference",
  "await_university_acknowledgement",
  "no_action",
];

describe("getWorkQueueBucket()", () => {
  it("maps every NextOperationalActionKind to exactly one bucket, with no kind left unmapped", () => {
    for (const kind of ALL_KINDS) {
      expect(WORK_QUEUE_BUCKET_ORDER).toContain(getWorkQueueBucket(kind));
    }
  });

  it("groups every staff-actionable kind (review, request, checklist, add-reference) into needs_action", () => {
    expect(getWorkQueueBucket("review_documents")).toBe("needs_action");
    expect(getWorkQueueBucket("request_missing_documents")).toBe("needs_action");
    expect(getWorkQueueBucket("complete_checklist_item")).toBe("needs_action");
    expect(getWorkQueueBucket("add_application_reference")).toBe("needs_action");
  });

  it("keeps waiting_on_student, ready_for_submission, awaiting_university, no_action and closed each their own bucket", () => {
    expect(getWorkQueueBucket("waiting_on_student")).toBe("waiting_on_student");
    expect(getWorkQueueBucket("ready_for_submission")).toBe("ready_for_submission");
    expect(getWorkQueueBucket("await_university_acknowledgement")).toBe("awaiting_university");
    expect(getWorkQueueBucket("no_action")).toBe("no_action");
    expect(getWorkQueueBucket("closed")).toBe("closed");
  });
});

describe("WORK_QUEUE_BUCKET_LABELS / WORK_QUEUE_BUCKET_ORDER", () => {
  it("has exactly one label per bucket in the order list, and vice versa", () => {
    const orderSet = new Set(WORK_QUEUE_BUCKET_ORDER);
    const labelKeys = Object.keys(WORK_QUEUE_BUCKET_LABELS) as WorkQueueBucket[];
    expect(new Set(labelKeys)).toEqual(orderSet);
  });

  it("every label is non-empty human-readable text, never a raw enum value", () => {
    for (const bucket of WORK_QUEUE_BUCKET_ORDER) {
      expect(WORK_QUEUE_BUCKET_LABELS[bucket].length).toBeGreaterThan(0);
      expect(WORK_QUEUE_BUCKET_LABELS[bucket]).not.toBe(bucket);
    }
  });
});

describe("getWorkQueueSummary()", () => {
  it("tallies kinds into bucket counts", () => {
    const summary = getWorkQueueSummary(["review_documents", "review_documents", "waiting_on_student", "ready_for_submission"]);
    expect(summary).toEqual([
      { bucket: "needs_action", count: 2 },
      { bucket: "waiting_on_student", count: 1 },
      { bucket: "ready_for_submission", count: 1 },
    ]);
  });

  it("omits any bucket with zero items rather than including a zero count", () => {
    const summary = getWorkQueueSummary(["no_action"]);
    expect(summary).toEqual([{ bucket: "no_action", count: 1 }]);
  });

  it("returns an empty list for an empty input, never a list of zero-count buckets", () => {
    expect(getWorkQueueSummary([])).toEqual([]);
  });

  it("orders buckets by WORK_QUEUE_BUCKET_ORDER regardless of input order", () => {
    const summary = getWorkQueueSummary(["closed", "no_action", "waiting_on_student", "review_documents"]);
    expect(summary.map((s) => s.bucket)).toEqual(["needs_action", "waiting_on_student", "no_action", "closed"]);
  });
});

describe("sortByWorkQueueBucket()", () => {
  interface Row {
    id: string;
    bucket: WorkQueueBucket;
  }
  const bucketOf = (r: Row) => r.bucket;

  it("orders items by bucket priority", () => {
    const rows: Row[] = [
      { id: "a", bucket: "closed" },
      { id: "b", bucket: "needs_action" },
      { id: "c", bucket: "waiting_on_student" },
    ];
    expect(sortByWorkQueueBucket(rows, bucketOf).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("preserves the caller's relative order within the same bucket (stable sort)", () => {
    const rows: Row[] = [
      { id: "first", bucket: "needs_action" },
      { id: "second", bucket: "needs_action" },
      { id: "third", bucket: "needs_action" },
    ];
    expect(sortByWorkQueueBucket(rows, bucketOf).map((r) => r.id)).toEqual(["first", "second", "third"]);
  });

  it("does not mutate the input array", () => {
    const rows: Row[] = [
      { id: "a", bucket: "closed" },
      { id: "b", bucket: "needs_action" },
    ];
    const copy = [...rows];
    sortByWorkQueueBucket(rows, bucketOf);
    expect(rows).toEqual(copy);
  });

  it("is a pure function — same input always yields the same output", () => {
    const rows: Row[] = [
      { id: "a", bucket: "ready_for_submission" },
      { id: "b", bucket: "needs_action" },
    ];
    expect(sortByWorkQueueBucket(rows, bucketOf)).toEqual(sortByWorkQueueBucket(rows, bucketOf));
  });
});
