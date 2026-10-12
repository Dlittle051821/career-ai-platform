import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ContainerProps {
  as?: ElementType;
  children: ReactNode;
  className?: string;
}

/**
 * Centralises the site's max content width and horizontal gutters.
 *
 * UX10-H03 "Exact Homepage Reference Match" — `className` now REPLACES the
 * default `max-w-[1240px]` instead of being appended alongside it via
 * `cn()`. `cn()` is a plain string-join (see src/lib/utils.ts), not a
 * tailwind-merge dedupe, so two `max-w-[...]` arbitrary-value utilities
 * present at once resolve by Tailwind's generated-stylesheet order, not by
 * which one appears later in the className string — the exact ambiguity
 * UX10-H01 already hit once this project. Before this change nothing in
 * the codebase ever passed `className` to `Container` (confirmed by
 * search), so this is behavior-preserving for all 65+ existing `<Section>`
 * callers; it only takes effect where a caller explicitly opts in via
 * `Section`'s own `containerClassName` prop (first used by the homepage
 * sections, to reach this brief's ~1560px reference-match width without
 * touching this shared default for every other page).
 */
export function Container({ as: Tag = "div", children, className }: ContainerProps) {
  return (
    <Tag className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", className ?? "max-w-[1240px]")}>
      {children}
    </Tag>
  );
}
