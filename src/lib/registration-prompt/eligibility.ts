/**
 * NW08.5 — Smart Student Registration Prompt: pure, framework-free
 * eligibility/timing logic.
 *
 * Same "pure lib vs I/O component" split used throughout this codebase
 * (src/lib/admin/status.ts, src/lib/recommendations/readiness.ts,
 * src/lib/navigation/account-menu.ts, ...): every decision that can be
 * made from plain inputs (a pathname, a timestamp) lives here, fully unit
 * tested; the actual localStorage/sessionStorage reads live in
 * ./storage.ts as a thin, deliberately-untested I/O wrapper, and the
 * timer/visibility orchestration + rendering live in the React component
 * (src/components/registration-prompt/RegistrationPrompt.tsx).
 */

/** How long of cumulative, visible, on-an-eligible-page time must pass before the first prompt — the brief's own "~45 seconds of engaged browsing." */
export const ENGAGED_THRESHOLD_MS = 45_000;

/** How long a dismissal suppresses the prompt — the brief's own "7 days." */
export const SUPPRESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Path prefixes the prompt must never appear on, per the brief:
 * "never on login/register/password-reset/checkout/payment/private/admin
 * pages... never interrupt active forms/sensitive workflows." Deliberately
 * mirrors (but does not import, to avoid an unrelated SEO-config module
 * depending on a UX-prompt module) the same private/auth/admin route
 * families src/app/robots.ts's DISALLOWED_PATHS already treats as
 * non-public, plus the public-but-sensitive pricing/checkout and
 * discovery-session booking flows the brief calls out by name.
 */
export const EXCLUDED_PATH_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/welcome",
  "/dashboard",
  "/profile",
  "/saved",
  "/applications",
  "/payments",
  "/agreements",
  "/pricing/checkout",
  "/discovery-session",
  "/recommendations",
  "/roadmap",
  "/pay",
  "/admin",
  "/studio",
  "/counsellor",
  "/go",
  "/api",
] as const;

/**
 * True when `pathname` is one of the eligible public pages the prompt may
 * appear on — i.e. it is not one of EXCLUDED_PATH_PREFIXES' bare paths or
 * anything nested under them. Mirrors isNavLinkActive's own
 * exact-or-prefixed-with-slash matching (src/lib/navigation/active-nav.ts)
 * so "/pricing/checkout" excludes that flow without also excluding the
 * public "/pricing" page itself.
 */
export function isPathEligibleForPrompt(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return !EXCLUDED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** True when `dismissedUntilMs` is set and still in the future relative to `nowMs` — i.e. the 7-day suppression window from the last dismissal hasn't elapsed yet. */
export function isSuppressedByPriorDismissal(nowMs: number, dismissedUntilMs: number | null): boolean {
  if (dismissedUntilMs == null) return false;
  return nowMs < dismissedUntilMs;
}

/** The new `dismissedUntil` timestamp (ms since epoch) to persist the moment a visitor dismisses the prompt — `nowMs` plus the 7-day suppression window. */
export function computeDismissUntil(nowMs: number): number {
  return nowMs + SUPPRESSION_DURATION_MS;
}

/**
 * The single gate deciding whether the prompt may be shown right now,
 * folding together every non-timer condition the brief lists: must be
 * anonymous, must be on an eligible page, must not have already been
 * shown this visit, and must not be inside an active 7-day suppression
 * window. The 45-second engaged-time accumulation itself is orchestration
 * (it depends on wall-clock ticks and tab visibility), not a pure
 * predicate, so it stays in the component — this function is what that
 * component calls once its own timer reaches ENGAGED_THRESHOLD_MS, and
 * also what a contextual trigger (e.g. an anonymous "Save" click) calls
 * immediately, bypassing the timer entirely.
 */
export function canShowRegistrationPrompt(input: {
  isAuthenticated: boolean;
  pathname: string | null | undefined;
  alreadyShownThisVisit: boolean;
  nowMs: number;
  dismissedUntilMs: number | null;
}): boolean {
  if (input.isAuthenticated) return false;
  if (!isPathEligibleForPrompt(input.pathname)) return false;
  if (input.alreadyShownThisVisit) return false;
  if (isSuppressedByPriorDismissal(input.nowMs, input.dismissedUntilMs)) return false;
  return true;
}
