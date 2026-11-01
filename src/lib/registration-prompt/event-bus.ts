/**
 * NW08.5 — Smart Student Registration Prompt: the contextual-trigger
 * extension point.
 *
 * The brief prefers CONTEXTUAL prompts — triggered when an anonymous
 * visitor tries to save a career/university, build a shortlist, preserve
 * a comparison, or use another personalised feature — "as a replacement
 * for the timed interruption where applicable." `requestRegistrationPrompt`
 * is the one function any such interaction calls; `RegistrationPrompt.tsx`
 * listens for it via a plain `window` CustomEvent (so this module itself
 * stays a tiny, dependency-free pub/sub with no React import) and opens
 * immediately, bypassing the 45-second timer, subject to the exact same
 * eligibility gate (anonymous, eligible page, not shown this visit, not
 * suppressed) the timer path uses — a contextual trigger never overrides
 * "never show to authenticated users" or the 7-day suppression.
 *
 * DISCLOSED SCOPE: this milestone wires the dispatcher and the listener
 * end to end and exercises it from the timed path. It does NOT retrofit
 * every existing anonymous "save" affordance to call it — in particular,
 * `SaveUniversityButton.tsx`'s existing logged-out state (a direct,
 * honest "Log in to save" link straight to `/login?next=...`) is left
 * exactly as it is: that is already a correct, tested, zero-friction
 * anonymous-save UX, and replacing a direct link with an interrupting
 * modal for an already-working flow is a regression this milestone's own
 * "low-risk only, do not rebuild working flows" instruction counsels
 * against. This event bus is real, working infrastructure a future
 * contextual trigger can call in one line
 * (`requestRegistrationPrompt("save-university")`) — see
 * docs/milestones/NW08.5/NW085_06_REGISTRATION_PROMPT.md §4 for the exact
 * call sites a later pass could wire this into.
 */

export const REGISTRATION_PROMPT_REQUEST_EVENT = "nextwise:registration-prompt-request";

export interface RegistrationPromptRequestDetail {
  /** A short, human-readable reason for telemetry/debugging only — never rendered to the visitor and never sent anywhere; this stays entirely client-side. */
  reason: string;
}

/**
 * Ask the centrally-mounted `RegistrationPrompt` to open, if the visitor
 * is currently eligible. Safe to call from anywhere, including during
 * server-side rendering (a no-op when `window` doesn't exist yet).
 */
export function requestRegistrationPrompt(reason: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<RegistrationPromptRequestDetail>(REGISTRATION_PROMPT_REQUEST_EVENT, { detail: { reason } })
  );
}
