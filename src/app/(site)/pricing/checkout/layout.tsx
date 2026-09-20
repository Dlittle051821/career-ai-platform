import type { Metadata } from "next";

/**
 * M17A Step 2 — permanent, page-level noindex protection scoped ONLY to the
 * /pricing/checkout subtree (covers /pricing/checkout/[slug] today, and any
 * future page added under this folder automatically). Deliberately placed
 * here rather than on /pricing itself — /pricing is a public, indexable
 * marketing page (Group A in M17A_SEO_AUDIT.md) and must keep inheriting
 * the site's normal (currently blanket-temporary) robots default; a Next.js
 * layout only affects its own segment and descendants, never its ancestors,
 * so this cannot affect /pricing.
 *
 * /pricing/checkout is authenticated-only — see the "/pricing/checkout"
 * prefix in PROTECTED_PATHS, src/lib/supabase/middleware.ts — and must stay
 * unindexable independent of the temporary site-wide noindex on
 * src/app/(site)/layout.tsx (see M17A_SEO_AUDIT.md §H).
 *
 * Metadata-only pass-through layout — no markup change. See
 * src/app/(site)/profile/layout.tsx for the identical pattern.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PricingCheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
