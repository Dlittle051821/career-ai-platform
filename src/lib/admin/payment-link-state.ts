/**
 * Action-state shape for the "generate payment link" form
 * (src/components/admin/invoices/InvoiceActionForms.tsx's
 * CreatePaymentLinkForm). Kept in its own plain module — a "use server"
 * file (src/app/admin/invoices/actions.ts) may only export async
 * functions, never a type/const, per Next.js's Server Actions rules.
 */
export interface PaymentLinkActionState {
  error: string | null;
  url: string | null;
  expiresAt: string | null;
}

export const INITIAL_PAYMENT_LINK_STATE: PaymentLinkActionState = { error: null, url: null, expiresAt: null };
