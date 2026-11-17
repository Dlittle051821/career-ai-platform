"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight, X } from "lucide-react";
import { MAX_COMPARE_CAREERS, MIN_COMPARE_CAREERS } from "@/lib/careers/compare";
import { buildCompareHref, canCompare } from "@/lib/career-explorer/compare-selection";
import { useCompareSelection } from "./compare-store";

/**
 * The floating comparison tray. Appears once a career is selected, lists the
 * selection, and opens /compare when at least two careers are chosen.
 * Comparing is free: no account and no plan are needed.
 */
export function CompareTray() {
  const { entries, remove } = useCompareSelection();
  const visible = entries.length > 0;
  useEffect(() => {
    document.body.classList.toggle("ce-has-tray", visible);
    return () => document.body.classList.remove("ce-has-tray");
  }, [visible]);
  if (!visible) return null;
  const ready = canCompare(entries);
  return (
    <aside className="ce-tray" aria-label="Careers selected for comparison">
      <p className="ce-tray-label">
        <b>Compare</b>
        {entries.length} of {MAX_COMPARE_CAREERS}
      </p>
      <ul className="ce-tray-list">
        {entries.map((entry) => (
          <li key={entry.slug}>
            {entry.title}
            <button type="button" aria-label={`Remove ${entry.title} from comparison`} onClick={() => remove(entry.slug)}>
              <X aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {ready ? (
        <Link href={buildCompareHref(entries.map((e) => e.slug))} className="ce-btn" data-variant="primary" data-size="sm">
          Compare careers
          <ArrowRight aria-hidden="true" />
        </Link>
      ) : (
        <span className="ce-btn" data-variant="primary" data-size="sm" aria-disabled="true">
          Add {MIN_COMPARE_CAREERS - entries.length} more
        </span>
      )}
    </aside>
  );
}
