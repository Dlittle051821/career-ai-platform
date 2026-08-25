import { Search } from "lucide-react";
import { Select } from "@/components/forms/Select";
import { inputClasses, fieldBorder } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import type { CareerFamily, Industry, CareerTag } from "@/types/career";

interface CareerFilterBarProps {
  query: string;
  familyKey: string;
  industryKey: string;
  tagKey: string;
  families: CareerFamily[];
  industries: Industry[];
  tags: CareerTag[];
}

/**
 * A plain `method="get"` form to `/careers` — filtering works by reloading
 * the page with new query params, so it works with JavaScript disabled and
 * every filter combination is a shareable/bookmarkable URL. Submitting
 * always resets back to page 1 (there's no `page` field in this form).
 */
export function CareerFilterBar({ query, familyKey, industryKey, tagKey, families, industries, tags }: CareerFilterBarProps) {
  return (
    <form method="get" action="/careers" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
      <div className="relative sm:col-span-2 lg:col-span-1">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search career titles, e.g. &quot;data scientist&quot;"
          aria-label="Search careers"
          className={`${inputClasses} ${fieldBorder(undefined)} pl-10`}
        />
      </div>

      <Select name="family" defaultValue={familyKey} aria-label="Filter by career family">
        <option value="">All families</option>
        {families.map((f) => (
          <option key={f.familyKey} value={f.familyKey}>
            {f.name}
          </option>
        ))}
      </Select>

      <Select name="industry" defaultValue={industryKey} aria-label="Filter by industry">
        <option value="">All industries</option>
        {industries.map((i) => (
          <option key={i.industryKey} value={i.industryKey}>
            {i.name}
          </option>
        ))}
      </Select>

      <Select name="tag" defaultValue={tagKey} aria-label="Filter by tag">
        <option value="">All tags</option>
        {tags.map((t) => (
          <option key={t.tagKey} value={t.tagKey}>
            {t.label}
          </option>
        ))}
      </Select>

      <Button type="submit" className="justify-center">
        Search
      </Button>
    </form>
  );
}
