"use client";

/** "Highlight differences" — marks the cells that differ between the compared careers (the grid carries the per-cell flags). */
export function DiffToggle({ gridId }: { gridId: string }) {
  return (
    <label>
      <input type="checkbox" role="switch" onChange={(e) => document.getElementById(gridId)?.toggleAttribute("data-diff", e.currentTarget.checked)} />
      Highlight differences
    </label>
  );
}
