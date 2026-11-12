import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * CIUX-01 — the shared feature card: a whole-card link to a real route with
 * an icon chip, a title, one or two lines of description and an arrow that
 * turns coral on hover. Lifts 2 px on hover; static under reduced motion.
 * tone="ink" is the navy variant for one featured card in a grid.
 */
export function FeatureCard({
  href,
  title,
  description,
  icon,
  eyebrow,
  tone = "light",
  className,
}: {
  href: string;
  title: string;
  description: string;
  icon?: ReactNode;
  eyebrow?: string;
  tone?: "light" | "ink";
  className?: string;
}) {
  const ink = tone === "ink";
  return (
    <Link
      href={href}
      className={cn(
        "ciux-feature-card group relative flex h-full flex-col rounded-[var(--radius-card)] border p-6 transition-[transform,box-shadow,border-color] duration-[var(--duration-base)] ease-[var(--ease-out-soft)] hover:-translate-y-0.5 motion-reduce:transform-none",
        ink
          ? "border-transparent bg-ink text-on-ink hover:shadow-[0_24px_48px_-28px_rgba(3,4,95,0.9)]"
          : "border-primary/10 bg-surface text-text hover:border-primary/20 hover:shadow-lifted",
        className
      )}
    >
      <span className="flex items-start justify-between gap-4">
        {icon ? (
          <span
            aria-hidden="true"
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-2xl",
              ink ? "bg-white/10 text-[var(--brand-aqua)]" : "bg-[var(--brand-ice-pale)] text-primary"
            )}
          >
            {icon}
          </span>
        ) : (
          <span />
        )}
        <ArrowUpRight
          aria-hidden="true"
          className={cn(
            "h-5 w-5 shrink-0 transition-[transform,color] duration-[var(--duration-base)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none",
            ink ? "text-[var(--brand-action)]" : "text-muted group-hover:text-[var(--brand-coral-strong)]"
          )}
        />
      </span>
      {eyebrow ? (
        <span className={cn("mt-5 text-[13px] font-semibold", ink ? "text-[var(--brand-aqua)]" : "text-secondary-dark")}>{eyebrow}</span>
      ) : null}
      <span
        className={cn(
          "font-display text-xl font-semibold tracking-[-0.02em]",
          eyebrow ? "mt-1" : "mt-5",
          ink ? "text-on-ink" : "text-primary"
        )}
      >
        {title}
      </span>
      <span className={cn("mt-2 text-[15px] leading-relaxed", ink ? "text-on-ink-muted" : "text-muted")}>{description}</span>
    </Link>
  );
}
