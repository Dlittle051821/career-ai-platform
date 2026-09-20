import type { Metadata } from "next";

/**
 * M17A Step 2 — permanent, page-level noindex protection for the entire
 * /payments subtree (covers /payments and /payments/[invoiceId] today, and
 * any future page added under this folder automatically — the [invoiceId]
 * /pdf and /receipts/[transactionId] entries are route handlers, not pages,
 * so metadata doesn't apply to them either way). Authenticated-only — see
 * the "/payments" prefix in PROTECTED_PATHS, src/lib/supabase/middleware.ts
 * — and must stay unindexable independent of the temporary site-wide
 * noindex on src/app/(site)/layout.tsx (see M17A_SEO_AUDIT.md §H).
 *
 * Note: /pay/[token] is a SEPARATE top-level route (a tokenized payment
 * link, not nested under /payments) and already carries its own explicit
 * robots: noindex on its own page — left untouched by this change.
 *
 * Metadata-only pass-through layout — no markup change. See
 * src/app/(site)/profile/layout.tsx for the identical pattern.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PaymentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
