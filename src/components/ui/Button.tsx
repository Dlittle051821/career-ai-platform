import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "md" | "lg" | "sm";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-light active:bg-primary-dark shadow-soft",
  secondary:
    "bg-accent text-white hover:bg-accent-dark active:bg-accent-dark shadow-soft",
  outline:
    "border border-border-strong bg-transparent text-primary hover:bg-surface-alt",
  ghost: "bg-transparent text-primary hover:bg-surface-alt",
  /**
   * Destructive — for actions with irreversible or high-consequence effects
   * (cancel, remove, delete). Matches the color pattern already used by
   * `admin/ConfirmSubmitButton.tsx`'s hand-rolled "armed" state, added here
   * so new destructive actions can use the shared `Button` instead of
   * duplicating base classes. Existing `ConfirmSubmitButton` is left as-is
   * (it has its own two-step arm/confirm UX) rather than refactored in this
   * foundation pass — see docs/ux/UX01-02_FOUNDATION.md.
   */
  destructive: "bg-error text-white hover:bg-error/90 active:bg-error/90 shadow-soft",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-4 py-2 text-sm min-h-[40px]",
  md: "px-5 py-3 text-[15px] min-h-[44px]",
  lg: "px-6 py-3.5 text-base min-h-[48px]",
};

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
}

interface LinkButtonProps extends CommonProps {
  href: string;
  target?: string;
  rel?: string;
  "aria-label"?: string;
}

/** Navigational CTA — always a real route via next/link, never `href="#"`. */
export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  icon,
  trailingIcon,
  target,
  rel,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      className={cn(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className)}
      {...rest}
    >
      {icon}
      {children}
      {trailingIcon}
    </Link>
  );
}

interface ButtonProps extends CommonProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /**
   * Marks the button as mid-action (e.g. an in-flight client-side request).
   * Disables the button, sets `aria-busy`, and swaps the leading icon for a
   * spinner — `children` stays visible so callers can pass loading copy
   * (e.g. "Saving…") themselves, matching the pattern `SubmitButton.tsx`
   * already uses for Server Actions via `useFormStatus()`. Purely additive:
   * omitting `loading` (the default) changes nothing about existing usage.
   */
  loading?: boolean;
}

/** Action button for form submits and interactive controls (not navigation). */
export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  icon,
  trailingIcon,
  type = "button",
  loading = false,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className)}
      {...rest}
    >
      {loading ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4 animate-spin motion-reduce:animate-none"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        icon
      )}
      {children}
      {trailingIcon}
    </button>
  );
}
