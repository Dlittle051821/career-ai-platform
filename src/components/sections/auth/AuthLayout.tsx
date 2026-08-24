import type { ReactNode } from "react";
import { Logo } from "@/components/navigation/Logo";

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Shared centered-card shell for /login, /register, /forgot-password, /reset-password. */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-[calc(100vh-4.5rem-1px)] items-center justify-center bg-surface-alt px-4 py-12 sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-lifted sm:p-8">
          <h1 className="text-center text-2xl font-semibold text-primary balance">{title}</h1>
          {description ? (
            <p className="mt-2 text-center text-sm leading-relaxed text-muted">{description}</p>
          ) : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <div className="mt-6 text-center text-sm text-muted">{footer}</div> : null}
      </div>
    </div>
  );
}
