import type { Metadata } from "next";

/**
 * M17A Step 2 — permanent, page-level noindex protection for the entire
 * /profile subtree (covers /profile and /profile/onboarding today, and any
 * future page added under this folder automatically). This route is
 * authenticated-only — see the "/profile" prefix in PROTECTED_PATHS,
 * src/lib/supabase/middleware.ts — and must stay unindexable independent of
 * the temporary site-wide noindex on src/app/(site)/layout.tsx, which will
 * eventually be lifted from the public pages (see M17A_SEO_AUDIT.md §H).
 *
 * This layout intentionally renders nothing but its children: it exists
 * purely to attach metadata to this subtree, not to change markup, styling,
 * or behavior. The public header/footer and <html>/<body> shell already
 * come from the shared src/app/(site)/layout.tsx above this one.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
