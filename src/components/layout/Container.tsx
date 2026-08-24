import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ContainerProps {
  as?: ElementType;
  children: ReactNode;
  className?: string;
}

/** Centralises the site's max content width and horizontal gutters. */
export function Container({ as: Tag = "div", children, className }: ContainerProps) {
  return (
    <Tag className={cn("mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </Tag>
  );
}
