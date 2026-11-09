/**
 * CC-22B — client-safe constants for the launch payment mode. The decision
 * itself (resolvePaymentLaunchMode) lives in launch-mode.ts, which is
 * server-only; components receive the resolved boolean as a prop.
 */

/** Student-facing wording, kept in one place so every surface says the same thing. */
export const PAID_CHECKOUT_PAUSED_TITLE = "Online payment isn't open yet";
export const PAID_CHECKOUT_PAUSED_MESSAGE =
  "Online payment isn't available on Nextwise yet, so nothing can be purchased here and you have not been charged. The prices shown are for information. The best first step is a free Discovery Session.";
export const OPEN_INVOICE_PAYMENT_PAUSED_MESSAGE =
  "Online payment isn't available on Nextwise yet, so this invoice can't be paid here. It stays open on your account exactly as shown above — nothing has been charged through this page.";
export const DISCOVERY_SESSION_BOOKING_PATH = "/discovery-session/book";
