import type { ReactNode } from "react";
import { Logo } from "@/components/navigation/Logo";
import { Card } from "@/components/ui/Card";

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Shared centered-card shell for /login, /register, /forgot-password,
 * /reset-password. UX03 — migrated onto the shared `Card` primitive
 * (was a hand-rolled div with the same border/radius/surface classes);
 * `padded={false}` plus an explicit className preserves this layout's
 * own padding (p-6 sm:p-8) and shadow exactly as before — a visual no-op.
 */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-[calc(100vh-4.5rem-1px)] items-center justify-center bg-surface-alt px-4 py-12 sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Card padded={false} className="p-6 shadow-lifted sm:p-8">
          <h1 className="text-center text-2xl font-semibold text-primary balance">{title}</h1>
          {description ? (
            <p className="mt-2 text-center text-sm leading-relaxed text-muted">{description}</p>
          ) : null}
          <div className="mt-6">{children}</div>
        </Card>
        {footer ? <div className="mt-6 text-center text-sm text-muted">{footer}</div> : null}
      </div>
    </div>
  );
}
