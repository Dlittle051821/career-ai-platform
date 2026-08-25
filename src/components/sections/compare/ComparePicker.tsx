import { Select } from "@/components/forms/Select";
import { Button } from "@/components/ui/Button";
import type { CareerOption } from "@/types/career";

interface ComparePickerProps {
  options: CareerOption[];
  selected: (string | undefined)[]; // slugs currently in slots a/b/c, in order
}

const SLOT_NAMES = ["a", "b", "c"] as const;
const SLOT_LABELS = ["First career", "Second career", "Third career (optional)"];

/**
 * Plain `method="get"` form, same philosophy as `CareerFilterBar` — picking
 * careers and comparing works with JavaScript disabled, and every
 * combination is a shareable/bookmarkable URL (`/compare?a=...&b=...`).
 * Three native `<select>` elements are simple, fully keyboard-accessible,
 * and more than sufficient for choosing 2-3 out of roughly a hundred
 * careers — no client-side autocomplete needed.
 */
export function ComparePicker({ options, selected }: ComparePickerProps) {
  return (
    <form method="get" action="/compare" className="grid gap-3 sm:grid-cols-3 sm:items-end">
      {SLOT_NAMES.map((name, i) => (
        <div key={name}>
          <label htmlFor={`compare-${name}`} className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
            {SLOT_LABELS[i]}
          </label>
          <Select id={`compare-${name}`} name={name} defaultValue={selected[i] ?? ""}>
            <option value="">{i < 2 ? "Choose a career…" : "— None —"}</option>
            {options.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.title} ({o.familyName})
              </option>
            ))}
          </Select>
        </div>
      ))}
      <Button type="submit" className="justify-center sm:col-span-3">
        Compare
      </Button>
    </form>
  );
}
