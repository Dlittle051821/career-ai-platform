import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

export function Card({ as: Tag = "div", children, className, padded = true }: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-[var(--radius-card)] border border-border bg-surface",
        padded && "p-6 sm:p-7",
        className
      )}
    >
      {children}
    </Tag>
  );
}
