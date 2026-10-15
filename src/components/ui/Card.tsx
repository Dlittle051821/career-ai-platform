import type { CSSProperties, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  padded?: boolean;
  /**
   * UX10-PR01B — optional passthrough for a per-instance dynamic value
   * (e.g. a plan-accent color keyed by slug, see plan-accent.ts) that can't
   * be expressed as a static Tailwind class. Purely additive: every
   * existing caller omits it and gets the exact same `undefined` style
   * attribute (i.e. no change) as before this prop existed.
   */
  style?: CSSProperties;
}

export function Card({ as: Tag = "div", children, className, padded = true, style }: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-[var(--radius-card)] border border-border bg-surface",
        padded && "p-6 sm:p-7",
        className
      )}
      style={style}
    >
      {children}
    </Tag>
  );
}
