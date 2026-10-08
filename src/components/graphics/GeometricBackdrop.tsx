import { useId } from "react";
import { cn } from "@/lib/utils";

interface GeometricBackdropProps {
  className?: string;
  /** "wash" = soft blurred color fields only (what Hero.tsx already used before this pass). "grid" = a faint rotated line pattern only. "both" (default) layers both for the restrained depth the task asks for ("thin geometric patterns" + "very light accent washes"), never a heavy or busy combination. */
  variant?: "wash" | "grid" | "both";
}

/**
 * UX09 Part C — the third graphics-system component. Always decorative
 * (it never carries page content, so it is unconditionally aria-hidden —
 * it does not take a `GraphicAccessibility` prop the way the other two
 * do, because there is no meaningful variant of a background). Replaces
 * the one-off absolutely-positioned blur-circle `<div>`s that Hero.tsx
 * already had with a single reusable piece, so the homepage, the
 * careers/courses/universities headers, and the career-discovery opening
 * state all get the same restrained surface-depth treatment instead of
 * each page inventing its own.
 *
 * Intentionally subtle — opacity on the grid is kept low (0.035) and the
 * color washes reuse the same blur-3xl treatment already reviewed in the
 * pre-UX09 Hero, specifically to avoid the "gradient soup / neon" look
 * the task's own PAGE DEPTH section forbids.
 */
export function GeometricBackdrop({ className, variant = "both" }: GeometricBackdropProps) {
  const patternId = useId();

  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      {variant !== "grid" ? (
        <>
          <div className="absolute -top-32 right-[-10%] h-[26rem] w-[26rem] rounded-full bg-secondary/10 blur-3xl" />
          <div className="absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-intelligence/10 blur-3xl" />
        </>
      ) : null}
      {variant !== "wash" ? (
        <svg className="absolute inset-0 h-full w-full text-primary opacity-[0.035]">
          <defs>
            <pattern id={patternId} width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
              <line x1="0" y1="0" x2="0" y2="40" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </svg>
      ) : null}
    </div>
  );
}
