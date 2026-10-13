import { Compass, Search, Tag as TagIcon, Building2 } from "lucide-react";
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
 *
 * UX10-C01 — each real field now carries a leading icon (composed around
 * the shared `Select`/`inputClasses` primitives, which are left
 * unmodified since they're reused across the rest of the app) to match
 * the reference mockup's icon-prefixed filter row. Still exactly the same
 * four real fields (search/family/industry/tag) this page's own real
 * `searchCareers()` supports — the mockup's own "Strengths"/"Work
 * style"/"Study preference"/"Destination" fields have no matching real
 * filter in `searchCareers()` (see `src/types/career.ts`'s
 * `CareerSearchFilters`), so a fifth, non-functional field was not added.
 */
export function CareerFilterBar({ query, familyKey, industryKey, tagKey, families, industries, tags }: CareerFilterBarProps) {
  return (
    // UX10-C01 — the 5-across row (search + 3 icon-prefixed selects +
    // button) needs more room than `lg:` (1024px) actually has once each
    // select's own leading icon and padding are accounted for — at 1024
    // every field visibly truncated ("All famil…", "All indust…"), the
    // same class of "breakpoint fires before there's genuinely enough
    // width" bug this project has hit repeatedly (e.g. UX10-D01's
    // Profile Completeness row, UX10-P01's summary card). Moved to `xl:`
    // (1280px) so 1024 instead falls back to the two-column `sm:` grid,
    // which already has plenty of room — found and fixed during this
    // milestone's own visual-QA pass.
    <form method="get" action="/careers" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto]">
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

      <div className="relative">
        <Compass aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted" />
        <Select name="family" defaultValue={familyKey} aria-label="Filter by career family" className="pl-10">
          <option value="">All families</option>
          {families.map((f) => (
            <option key={f.familyKey} value={f.familyKey}>
              {f.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="relative">
        <Building2 aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted" />
        <Select name="industry" defaultValue={industryKey} aria-label="Filter by industry" className="pl-10">
          <option value="">All industries</option>
          {industries.map((i) => (
            <option key={i.industryKey} value={i.industryKey}>
              {i.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="relative">
        <TagIcon aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted" />
        <Select name="tag" defaultValue={tagKey} aria-label="Filter by tag" className="pl-10">
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t.tagKey} value={t.tagKey}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>

      <Button type="submit" className="justify-center">
        Find careers
      </Button>
    </form>
  );
}
