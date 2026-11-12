import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * CIUX-01 — the one Nextwise button system, matching the approved V5.4
 * homepage controls (pill shape, Electric Coral primary with navy text,
 * navy secondary, quiet outline). Every variant shares height, type,
 * padding, radius, hover lift, press feedback, focus ring, disabled and
 * loading behaviour; only colour differs. Values come from the tokens in
 * src/app/globals.css, never hard-coded hex.
 *
 *  primary     Electric Coral, navy text — the main action on a view (use once per view)
 *  secondary   navy solid, white text — strong alternative action
 *  outline     navy hairline — tertiary / "Log in" style
 *  ghost|text  no surface, navy text — inline actions
 *  inverse     white on navy bands (CTA bands, footer)
 *  destructive red — irreversible actions
 *
 * The API is unchanged from UX01-02 (variant, size, icon, trailingIcon,
 * loading), so every existing caller keeps working.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "outline-inverse"
  | "ghost"
  | "text"
  | "inverse"
  | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-action text-on-action hover:bg-action-hover hover:shadow-[var(--shadow-action)] active:bg-action-active",
  secondary: "bg-primary text-on-primary-strong hover:bg-primary-light active:bg-primary-dark",
  outline:
    "border border-primary/20 bg-surface text-primary hover:border-primary/45 hover:shadow-soft active:bg-surface-alt",
  ghost: "bg-transparent text-primary hover:bg-surface-alt active:bg-surface-alt",
  text: "bg-transparent px-1 text-primary underline-offset-4 hover:underline",
  // Outline for dark (navy/ink) surfaces: white text and hairline, no fill.
  "outline-inverse": "border border-white/35 bg-transparent text-white hover:bg-white/10 active:bg-white/15",
  inverse: "bg-white text-primary hover:bg-[var(--brand-ice)] active:bg-[var(--brand-ice)]",
  destructive: "bg-error text-white hover:bg-error/90 active:bg-error/90",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-[40px] px-4 text-sm",
  md: "min-h-[44px] px-5 text-[15px]",
  lg: "min-h-[52px] px-7 text-base",
};

/** Shared base: pill, 600 weight, lift on hover, press feedback, visible focus. */
export const BUTTON_BASE_CLASSES =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-pill)] font-semibold tracking-[-0.005em] " +
  "transition-[background-color,border-color,box-shadow,transform,color] duration-[var(--duration-base)] ease-[var(--ease-out-soft)] " +
  "hover:-translate-y-px active:translate-y-0 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-focus)] " +
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

/** Class string for any element that must look like a button (e.g. a <summary>). */
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(BUTTON_BASE_CLASSES, VARIANT_CLASSES[variant], variant === "text" ? "min-h-[44px]" : SIZE_CLASSES[size], className);
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
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
  "aria-current"?: "page" | undefined;
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
    <Link href={href} target={target} rel={rel} className={buttonClasses(variant, size, className)} {...rest}>
      {icon}
      {children}
      {trailingIcon}
    </Link>
  );
}

function Spinner() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 animate-spin motion-reduce:animate-none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

interface ButtonProps extends CommonProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /**
   * Marks the button as mid-action (e.g. an in-flight client-side request).
   * Disables the button, sets `aria-busy`, and swaps the leading icon for a
   * spinner — `children` stays visible so callers can pass loading copy
   * (e.g. "Saving…") themselves.
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
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {trailingIcon}
    </button>
  );
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Required: an icon-only control must have an accessible name. */
  label: string;
  children: ReactNode;
  variant?: "outline" | "ghost" | "primary";
  size?: "sm" | "md";
}

/** CIUX-01 — round icon-only button (44 px default, 40 px small). */
export function IconButton({ label, children, variant = "outline", size = "md", className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        BUTTON_BASE_CLASSES,
        VARIANT_CLASSES[variant],
        "px-0 hover:translate-y-0",
        size === "sm" ? "h-10 w-10" : "h-11 w-11",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
