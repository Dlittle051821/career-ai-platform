import { Plus } from "lucide-react";
import type { FaqItem } from "@/types";

/**
 * Native <details>/<summary> accordion — fully keyboard accessible and
 * exposes expanded/collapsed state to assistive tech without any custom
 * ARIA wiring or client-side JavaScript.
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface">
      {items.map((item) => (
        <details key={item.question} className="group px-5 py-1 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-base font-medium text-text marker:content-none">
            {item.question}
            <Plus
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-secondary transition-transform duration-200 group-open:rotate-45"
            />
          </summary>
          <p className="pb-5 text-[15px] leading-relaxed text-muted">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
