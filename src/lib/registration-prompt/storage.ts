/**
 * NW08.5 — Smart Student Registration Prompt: thin, deliberately-untested
 * browser-storage I/O wrapper. See eligibility.ts's own docblock for why
 * this split exists and why this file (all real `localStorage`/
 * `sessionStorage` reads/writes, wrapped in try/catch for private-
 * browsing/SSR safety) is reviewed structurally rather than unit tested,
 * the same convention this codebase already applies to every Supabase-
 * calling "thin wrapper" module.
 *
 * Two different storage lifetimes, chosen deliberately:
 *  - `localStorage` for the 7-day dismissal suppression — must survive a
 *    closed tab/browser restart, exactly what the brief's "7 days" means.
 *  - `sessionStorage` for "already shown this visit" — must NOT survive a
 *    closed tab (a new tab tomorrow is a new "visit"), but MUST survive a
 *    same-tab hard refresh or address-bar navigation within one visit,
 *    which a plain in-memory module variable would not.
 *
 * No PII of any kind is stored — only a boolean flag and a future
 * timestamp, both inert on their own. No new backend table, no server
 * round trip, no tracking profile beyond what the visitor's own browser
 * already retains for its own tab/session lifetime.
 */

const DISMISSED_UNTIL_KEY = "nw_registration_prompt_dismissed_until";
const SHOWN_THIS_VISIT_KEY = "nw_registration_prompt_shown_this_visit";

export function getDismissedUntilMs(): number | null {
  try {
    const raw = window.localStorage.getItem(DISMISSED_UNTIL_KEY);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    // Private-browsing storage denial, storage disabled, or no `window`
    // (SSR) — treat as "no prior dismissal" rather than throwing.
    return null;
  }
}

export function setDismissedUntilMs(untilMs: number): void {
  try {
    window.localStorage.setItem(DISMISSED_UNTIL_KEY, String(untilMs));
  } catch {
    // Best-effort only — a failed write just means the prompt may show
    // again sooner than 7 days on this device, never a crash.
  }
}

export function hasShownThisVisit(): boolean {
  try {
    return window.sessionStorage.getItem(SHOWN_THIS_VISIT_KEY) === "1";
  } catch {
    return false;
  }
}

export function markShownThisVisit(): void {
  try {
    window.sessionStorage.setItem(SHOWN_THIS_VISIT_KEY, "1");
  } catch {
    // Best-effort only.
  }
}
