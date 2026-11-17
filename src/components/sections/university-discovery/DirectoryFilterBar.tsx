"use client";

import { useRef } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import {
  DIRECTORY_SORTS,
  INSTITUTION_CATEGORIES,
  OWNERSHIP_OPTIONS,
  STUDY_AREAS,
  categoryLabel,
  directoryHref,
  hasActiveDirectoryFilters,
  studyAreaLabel,
  type DirectoryFilters,
} from "@/lib/education/university-discovery/directory";

interface DirectoryFilterBarProps {
  filters: DirectoryFilters;
  countries: { id: string; name: string }[];
  states: string[];
  /** False when the database has no category / study-area columns yet; those two controls are then hidden rather than shown doing nothing. */
  enriched: boolean;
}

/**
 * Directory filters. A plain GET form, so it works without JavaScript and the
 * result is a shareable URL; with JavaScript a change to any select applies at
 * once. The server validates every value again (parseDirectoryFilters).
 */
export function DirectoryFilterBar({ filters, countries, states, enriched }: DirectoryFilterBarProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();
  const countryName = countries.find((country) => country.id === filters.country)?.name;

  const chips: { label: string; href: string }[] = [];
  if (filters.q) chips.push({ label: `"${filters.q}"`, href: directoryHref(filters, { q: "" }) });
  if (filters.country && countryName) chips.push({ label: countryName, href: directoryHref(filters, { country: "", state: "" }) });
  if (filters.state) chips.push({ label: filters.state, href: directoryHref(filters, { state: "" }) });
  if (filters.city) chips.push({ label: `City: ${filters.city}`, href: directoryHref(filters, { city: "" }) });
  if (filters.category) chips.push({ label: categoryLabel(filters.category, "short") ?? filters.category, href: directoryHref(filters, { category: "" }) });
  if (filters.ownership) chips.push({ label: filters.ownership === "public" ? "Public" : "Private", href: directoryHref(filters, { ownership: "" }) });
  if (filters.area) chips.push({ label: studyAreaLabel(filters.area) ?? filters.area, href: directoryHref(filters, { area: "" }) });

  return (
    <form ref={formRef} className="ud-filters" action="/universities" method="get" role="search" aria-label="Filter universities" autoComplete="off">
      <div className="ud-filters-row">
        <label className="ud-field" data-search>
          <span>Search</span>
          <Search aria-hidden="true" />
          <input type="search" name="q" defaultValue={filters.q} placeholder="University name or city" maxLength={80} autoComplete="off" />
        </label>
        <label className="ud-field">
          <span>Country</span>
          <select name="country" defaultValue={filters.country} onChange={submit}>
            <option value="">All countries</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>{country.name}</option>
            ))}
          </select>
        </label>
        <label className="ud-field">
          <span>State / region</span>
          <select name="state" defaultValue={states.includes(filters.state) ? filters.state : ""} onChange={submit}>
            <option value="">All regions</option>
            {states.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </label>
        <label className="ud-field">
          <span>City</span>
          <input type="text" name="city" defaultValue={filters.city} placeholder="Any city" maxLength={80} autoComplete="off" />
        </label>
      </div>
      <div className="ud-filters-row">
        {enriched ? (
          <label className="ud-field">
            <span>Institution type</span>
            <select name="category" defaultValue={filters.category} onChange={submit}>
              <option value="">University or Hochschule</option>
              {INSTITUTION_CATEGORIES.map((entry) => (
                <option key={entry.value} value={entry.value}>{entry.label}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="ud-field">
          <span>Public / private</span>
          <select name="ownership" defaultValue={filters.ownership} onChange={submit}>
            <option value="">Public and private</option>
            {OWNERSHIP_OPTIONS.map((entry) => (
              <option key={entry.value} value={entry.value}>{entry.label}</option>
            ))}
          </select>
        </label>
        {enriched ? (
          <label className="ud-field">
            <span>Study area</span>
            <select name="area" defaultValue={filters.area} onChange={submit}>
              <option value="">All study areas</option>
              {STUDY_AREAS.map((entry) => (
                <option key={entry.value} value={entry.value}>{entry.label}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="ud-field">
          <span>Sort by</span>
          <select name="sort" defaultValue={filters.sort} onChange={submit}>
            {DIRECTORY_SORTS.map((entry) => (
              <option key={entry.value} value={entry.value}>{entry.label}</option>
            ))}
          </select>
        </label>
        <div className="ud-filters-actions">
          <button type="submit" className="ud-btn" data-variant="navy">Apply filters</button>
        </div>
      </div>
      {hasActiveDirectoryFilters(filters) ? (
        <div className="ud-chips" aria-label="Active filters">
          {chips.map((chip) => (
            <Link key={chip.label} href={chip.href} className="ud-chip" aria-label={`Remove filter ${chip.label}`}>
              {chip.label}
              <X aria-hidden="true" />
            </Link>
          ))}
          <Link href="/universities" className="ud-chip" data-clear>Clear all</Link>
        </div>
      ) : null}
    </form>
  );
}
