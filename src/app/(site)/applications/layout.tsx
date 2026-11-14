import type { Metadata } from "next";
import { notFoundInPublicMarketingMode } from "@/lib/launch/server-gate";

/**
 * M17A Step 2 — permanent, page-level noindex protection for the entire
 * /applications subtree (covers /applications and /applications/[id] today,
 * and any future page added under this folder automatically). Authenticated
 * -only — see the "/applications" prefix in PROTECTED_PATHS,
 * src/lib/supabase/middleware.ts — and must stay unindexable independent of
 * the temporary site-wide noindex on src/app/(site)/layout.tsx (see
 * M17A_SEO_AUDIT.md §H).
 *
 * Metadata-only pass-through layout — no markup change. See
 * src/app/(site)/profile/layout.tsx for the identical pattern.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ApplicationsLayout({ children }: { children: React.ReactNode }) {
  notFoundInPublicMarketingMode(); // V5.6.2 public launch (src/lib/launch/launch-mode.ts)
  return children;
}
