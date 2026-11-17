"use client";

import { useState } from "react";
import { MAX_COMPARE_CAREERS } from "@/lib/careers/compare";
import { useCompareSelection } from "./compare-store";

/** Adds a career to (or removes it from) the free comparison selection. */
export function CompareToggle({ slug, title, inline = false }: { slug: string; title: string; inline?: boolean }) {
  const { entries, toggle } = useCompareSelection();
  const [full, setFull] = useState(false);
  const selected = entries.some((e) => e.slug === slug);
  return (
    <>
      <button
        type="button"
        className="ce-compare-toggle"
        data-inline={inline ? "" : undefined}
        aria-pressed={selected}
        aria-label={selected ? `Remove ${title} from comparison` : `Add ${title} to comparison`}
        onClick={() => {
          const status = toggle({ slug, title });
          setFull(status === "full");
          if (status === "full") window.setTimeout(() => setFull(false), 4000);
        }}
      >
        <i aria-hidden="true" />
        {selected ? "Comparing" : "Compare"}
      </button>
      {full ? (
        <div className="ce-toast" role="status">
          You can compare up to {MAX_COMPARE_CAREERS} careers. Remove one to add another.
        </div>
      ) : null}
    </>
  );
}
