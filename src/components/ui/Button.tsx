import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "md" | "lg" | "sm";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-light active:bg-primary-dark shadow-soft",
  secondary:
    "bg-accent text-white hover:bg-accent-dark active:bg-accent-dark shadow-soft",
  outline:
    "border border-border-strong bg-transparent text-primary hover:bg-surface-alt",
  ghost: "bg-transparent text-primary hover:bg-surface-alt",
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

interface ButtonProps extends CommonProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {}

/** Action button for form submits and interactive controls (not navigation). */
export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  icon,
  trailingIcon,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className)}
      {...rest}
    >
      {icon}
      {children}
      {trailingIcon}
    </button>
  );
}
