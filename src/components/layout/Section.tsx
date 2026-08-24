import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Container } from "./Container";

interface SectionProps {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  tone?: "default" | "surface" | "primary" | "muted";
  id?: string;
}

const TONE_CLASSES: Record<NonNullable<SectionProps["tone"]>, string> = {
  default: "bg-background",
  surface: "bg-surface",
  primary: "bg-primary text-on-primary",
  muted: "bg-surface-alt",
};

/** Consistent vertical rhythm and background tone between page sections. */
export function Section({
  as: Tag = "section",
  children,
  className,
  containerClassName,
  tone = "default",
  id,
}: SectionProps) {
  return (
    <Tag id={id} className={cn("py-14 sm:py-18 lg:py-24", TONE_CLASSES[tone], className)}>
      <Container className={containerClassName}>{children}</Container>
    </Tag>
  );
}
