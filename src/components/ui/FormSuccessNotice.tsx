import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormSuccessNoticeProps {
  title: string;
  children: ReactNode;
  /** `action` renders below the description — used by forms that let the visitor reset and try again. */
  action?: ReactNode;
  /** `md` (default) matches the original BookingForm/ContactForm sizing; `sm` matches the original WaitlistForm sizing. Purely a spacing/icon-size choice — same tone and structure either way. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * UX03 — shared "form preview completed" success notice. Consolidates
 * three previously hand-rolled, near-identical `role="status"` blocks
 * (BookingForm, WaitlistForm, ContactForm — all Milestone 1 demo-submit
 * confirmations) into one component. This is a pure visual/structural
 * consolidation: every call site's actual copy is unchanged, and this
 * component makes no claim about whether a submission was real or
 * demo-only — that wording stays entirely with the caller's `children`.
 */
export function FormSuccessNotice({ title, children, action, size = "md", className }: FormSuccessNoticeProps) {
  const isSmall = size === "sm";
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-card)] border border-success/25 bg-success-light text-success",
        isSmall ? "p-5" : "p-6",
        className
      )}
    >
      <CheckCircle2 aria-hidden="true" className={cn("mt-0.5 shrink-0", isSmall ? "h-5 w-5" : "h-6 w-6")} />
      <div>
        <p className={isSmall ? "font-semibold" : "text-base font-semibold"}>{title}</p>
        <p className={cn("mt-1 text-sm", !isSmall && "leading-relaxed")}>{children}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}
