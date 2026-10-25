import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { fontVariables } from "@/lib/fonts";
import { getCurrentAdmin } from "@/lib/supabase/admin-auth";
import { hasPermission } from "@/lib/admin/permissions";
import { CounsellorShell } from "@/components/counsellor/CounsellorShell";
import { logout } from "@/lib/supabase/actions";
import { BRAND_NAME } from "@/config/site";
import "../globals.css";

export const metadata: Metadata = {
  title: {
    default: "Counsellor Studio",
    template: `%s | ${BRAND_NAME} Counsellor Studio`,
  },
  robots: { index: false, follow: false },
};

/**
 * NW07 — root layout for the Counsellor Studio (`/counsellor/**`).
 *
 * Reuses `getCurrentAdmin()` — the exact same "who is this" resolver
 * `/admin/**` already uses — rather than a second auth system
 * (NW07_01_AUDIT.md §5). The gate here is NOT merely "any admin role" (as
 * `/admin`'s own layout uses): it additionally requires the new
 * `counsellor-studio:read` permission, which is deliberately withheld
 * from `finance`/`content_editor`/`analyst` (src/lib/admin/permissions.ts)
 * — those roles get the SAME honest, inline access-denied state a
 * signed-in non-admin gets on `/admin`, never a page that quietly renders
 * with zero data. This is a second, independent layer on top of
 * `getCurrentAdmin()` itself; the database's own RLS (restored to
 * dual-basis by NW07_counsellor_studio_foundation.sql PART 1) is the third
 * and final layer — same three-layer discipline `/admin`'s own layout
 * docblock describes.
 */
export default async function CounsellorRootLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  const authorized = admin && hasPermission(admin.role, "counsellor-studio:read");

  if (!admin || !authorized) {
    return (
      <html lang="en" className={fontVariables}>
        <body className="min-h-screen bg-background font-sans text-text antialiased">
          <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-error-light text-error">
              <ShieldAlert aria-hidden="true" className="h-7 w-7" />
            </span>
            <h1 className="mt-6 text-2xl font-semibold text-primary sm:text-3xl">Access denied</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
              {admin
                ? `Your admin role (${admin.role}) does not have access to the Counsellor Studio. If you believe this is a mistake, contact a super admin.`
                : `Your account is signed in, but it doesn't have an admin role on ${BRAND_NAME}. If you believe this is a mistake, contact a super admin.`}
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
        <CounsellorShell admin={admin}>{children}</CounsellorShell>
      </body>
    </html>
  );
}
