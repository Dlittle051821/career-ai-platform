"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { CareerFamily, CareerTag, Industry } from "@/types/career";

export interface CatalogueFilterValues {
  q: string;
  family: string;
  industry: string;
  tag: string;
}

/**
 * The catalogue filters — the three real filters searchCareers() supports
 * (field, industry, tag). A plain GET form to /careers: every combination is
 * a shareable URL and it works without scripts. On wide screens it is a
 * sticky side panel; on phones the same form is a bottom sheet opened by the
 * "Filters" button, with Apply and Reset.
 */
export function CatalogueFilters({
  values,
  families,
  industries,
  tags,
}: {
  values: CatalogueFilterValues;
  families: CareerFamily[];
  industries: Industry[];
  tags: CareerTag[];
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const opener = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLFormElement>(null);
  const activeCount = [values.family, values.industry, values.tag].filter(Boolean).length;

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("select")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      opener.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button ref={opener} type="button" className="ce-btn ce-filter-open" data-variant="outline" data-size="sm" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(true)}>
        <SlidersHorizontal aria-hidden="true" />
        Filters{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>
      {open ? <button type="button" className="ce-scrim" aria-label="Close filters" tabIndex={-1} onClick={() => setOpen(false)} /> : null}
      <form ref={panel} id={panelId} className="ce-filters" method="get" action="/careers" data-open={open ? "" : undefined} aria-label="Filter careers">
        <div className="ce-filters-head">
          <strong>
            <SlidersHorizontal aria-hidden="true" />
            Filters
          </strong>
          {activeCount > 0 ? <Link href={values.q ? `/careers?q=${encodeURIComponent(values.q)}` : "/careers#all-careers"}>Clear all</Link> : null}
          <button type="button" className="ce-filters-close" aria-label="Close filters" onClick={() => setOpen(false)}>
            <X aria-hidden="true" />
          </button>
        </div>
        {values.q ? <input type="hidden" name="q" value={values.q} /> : null}
        <label className="ce-field">
          <span>Field</span>
          <select name="family" defaultValue={values.family}>
            <option value="">Any</option>
            {families.map((f) => (
              <option key={f.familyKey} value={f.familyKey}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="ce-field">
          <span>Industry</span>
          <select name="industry" defaultValue={values.industry}>
            <option value="">Any</option>
            {industries.map((i) => (
              <option key={i.industryKey} value={i.industryKey}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <label className="ce-field">
          <span>Theme</span>
          <select name="tag" defaultValue={values.tag}>
            <option value="">Any</option>
            {tags.map((t) => (
              <option key={t.tagKey} value={t.tagKey}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="ce-btn" data-variant="primary" data-size="sm" data-block="">
          Apply filters
        </button>
      </form>
    </>
  );
}
