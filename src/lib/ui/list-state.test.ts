import { describe, expect, it } from "vitest";
import { resolveListEmptyState } from "./list-state";

describe("resolveListEmptyState", () => {
  it("returns has_results whenever at least one item came back, regardless of filters or error", () => {
    expect(resolveListEmptyState({ itemCount: 1, hasActiveFilters: false })).toBe("has_results");
    expect(resolveListEmptyState({ itemCount: 5, hasActiveFilters: true })).toBe("has_results");
    // itemCount > 0 always wins even if `error` was (incorrectly) also set.
    expect(resolveListEmptyState({ itemCount: 1, hasActiveFilters: false, error: true })).toBe("has_results");
  });

  it("returns error when the query genuinely failed, even with no active filters", () => {
    expect(resolveListEmptyState({ itemCount: 0, hasActiveFilters: false, error: true })).toBe("error");
  });

  it("returns error ahead of filtered_empty when both a filter and a real error are present", () => {
    expect(resolveListEmptyState({ itemCount: 0, hasActiveFilters: true, error: true })).toBe("error");
  });

  it("returns filtered_empty when filters are active, zero rows came back, and there was no error", () => {
    expect(resolveListEmptyState({ itemCount: 0, hasActiveFilters: true })).toBe("filtered_empty");
    expect(resolveListEmptyState({ itemCount: 0, hasActiveFilters: true, error: false })).toBe("filtered_empty");
  });

  it("returns dataset_empty when there are no filters, zero rows, and no error — a genuinely empty dataset, never described as a load failure", () => {
    expect(resolveListEmptyState({ itemCount: 0, hasActiveFilters: false })).toBe("dataset_empty");
    expect(resolveListEmptyState({ itemCount: 0, hasActiveFilters: false, error: false })).toBe("dataset_empty");
  });
});
