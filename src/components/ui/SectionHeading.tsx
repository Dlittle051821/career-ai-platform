import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
  as?: "h1" | "h2" | "h3";
  light?: boolean;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
  as: Tag = "h2",
  light = false,
}: SectionHeadingProps) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? (
        <p
          className={cn(
            "mb-3 text-sm font-semibold uppercase tracking-wide",
            light ? "text-on-primary-muted" : "text-secondary"
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <Tag className={cn("text-3xl sm:text-4xl font-semibold balance", light ? "text-on-primary" : "text-primary")}>
        {title}
      </Tag>
      {description ? (
        <p className={cn("mt-4 text-base sm:text-lg leading-relaxed", light ? "text-on-primary-muted" : "text-muted")}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
