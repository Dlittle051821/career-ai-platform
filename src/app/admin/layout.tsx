import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { fontVariables } from "@/lib/fonts";
import { getCurrentAdmin } from "@/lib/supabase/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { logout } from "@/lib/supabase/actions";
import { BRAND_NAME } from "@/config/site";
import "../globals.css";

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: `%s | ${BRAND_NAME} Admin`,
  },
  robots: { index: false, follow: false },
};

/**
 * Root layout for the internal admin system (`/admin/**`). This is the
 * SECOND enforcement layer for admin access, after middleware
 * (src/lib/supabase/middleware.ts, which redirects a logged-out visitor to
 * /login before this ever runs) and before every table's own RLS policy
 * (supabase/migrations/0004_admin_system.sql) — three independent layers,
 * on purpose (spec: "authorization must be enforced server-side and
 * through RLS", "hiding navigation links is not authorization").
 *
 * A signed-in user with no admin_roles row gets the access-denied state
 * rendered INLINE right here, rather than a redirect to a separate
 * "/admin/access-denied" route — that would create either a redirect loop
 * (that route is itself under /admin and would hit this same check) or
 * require excluding it from the layout tree in a way that's easy to get
 * wrong. Rendering the state directly is simpler and just as correct: no
 * admin markup is ever produced for a non-admin, at this layout, before a
 * single child page renders.
 */
export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return (
      <html lang="en" className={fontVariables}>
        <body className="min-h-screen bg-background font-sans text-text antialiased">
          <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-error-light text-error">
              <ShieldAlert aria-hidden="true" className="h-7 w-7" />
            </span>
            <h1 className="mt-6 text-2xl font-semibold text-primary sm:text-3xl">Access denied</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
              Your account is signed in, but it doesn&apos;t have an admin role on {BRAND_NAME}. If you believe this
              is a mistake, contact a super admin and ask them to grant your account access — see
              docs/admin-system-guide.md §3 for how a super admin does this.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] bg-primary px-5 py-3 text-[15px] font-medium text-on-primary shadow-soft hover:bg-primary-light"
              >
                Go to your dashboard
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-border-strong px-5 py-3 text-[15px] font-medium text-primary hover:bg-surface-alt"
                >
                  Log out
                </button>
              </form>
            </div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-screen bg-background font-sans text-text antialiased">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <AdminShell admin={admin}>{children}</AdminShell>
      </body>
    </html>
  );
}
