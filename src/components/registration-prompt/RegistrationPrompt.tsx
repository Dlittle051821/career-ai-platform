"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bookmark, GraduationCap, Sparkles, X } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { useAuthUser } from "@/lib/supabase/use-auth-user";
import {
  ENGAGED_THRESHOLD_MS,
  canShowRegistrationPrompt,
  computeDismissUntil,
} from "@/lib/registration-prompt/eligibility";
import {
  getDismissedUntilMs,
  hasShownThisVisit,
  markShownThisVisit,
  setDismissedUntilMs,
} from "@/lib/registration-prompt/storage";
import {
  REGISTRATION_PROMPT_HOLD_EVENT,
  REGISTRATION_PROMPT_REQUEST_EVENT,
  applyRegistrationPromptHold,
  type RegistrationPromptHoldDetail,
} from "@/lib/registration-prompt/event-bus";
import { FADE_UP_CLASSES } from "@/lib/ui/motion";

/**
 * NW08.5 — Smart Student Registration Prompt.
 *
 * Mounted exactly once, centrally, in `src/app/(site)/layout.tsx` (so it
 * is present across every public page without any per-page copy of this
 * component — the brief's own "single reusable, centrally-controlled
 * component" instruction) alongside `Header`/`Footer`. It renders nothing
 * until it decides to open.
 *
 * TIMING: a single `setInterval` (1s tick) accumulates engaged time —
 * only while the tab is visible (`document.visibilityState === "visible"`)
 * and the current route is eligible (`isPathEligibleForPrompt`) — in a
 * ref, so time spent on an excluded page (e.g. `/login`) or in a
 * backgrounded tab never counts toward the 45-second threshold. Because
 * this component lives in the shared `(site)` layout rather than being
 * remounted per page, the same interval survives client-side navigation
 * between public pages — "not retriggered on navigation" is automatic,
 * not something this component has to special-case.
 *
 * CONTEXTUAL TRIGGER: also listens for the `window` CustomEvent
 * `requestRegistrationPrompt()` dispatches (./event-bus.ts) and opens
 * immediately on receiving it, subject to the same eligibility gate as
 * the timer path.
 *
 * ACCESSIBILITY: uses the native `<dialog>` element via `showModal()` —
 * the same pattern this codebase's own `MobileNav.tsx` drawer already
 * uses and has had reviewed — which gives a built-in focus trap, native
 * Escape-to-close, a `::backdrop`, and automatic focus restoration to
 * whatever element had focus before the dialog opened, all without
 * hand-rolled focus-trap JavaScript. `aria-labelledby`/`aria-describedby`
 * point at the real headline/description text; the close control is a
 * visible, labelled button, not icon-only with no text alternative.
 * Entrance uses this codebase's existing `FADE_UP_CLASSES`
 * (src/lib/ui/motion.ts), which already carries its own
 * `motion-reduce:` override — no new, unreviewed animation primitive.
 */
const WORKSPACE_LINK_LABEL = "Create Free Student Account";

export function RegistrationPrompt() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const { user, ready } = useAuthUser();
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const descriptionId = useId();

  // Engaged-time accumulator. A ref (not state) because it ticks every
  // second and must not itself trigger a re-render — only crossing the
  // threshold does, via setOpen below.
  const engagedMsRef = useRef(0);
  const openedRef = useRef(false);
  // NW08.7 — active holds (e.g. the signature homepage hero while its story is on screen).
  // While any is raised, the TIMED path waits; contextual requests are unaffected.
  const holdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!ready) return; // Don't start counting until we know whether this visitor is anonymous.

    function tryOpen(reason: "timer" | "contextual") {
      if (openedRef.current) return;
      const canShow = canShowRegistrationPrompt({
        isAuthenticated: Boolean(user),
        pathname,
        alreadyShownThisVisit: hasShownThisVisit(),
        nowMs: Date.now(),
        dismissedUntilMs: getDismissedUntilMs(),
      });
      if (!canShow) return;
      openedRef.current = true;
      markShownThisVisit();
      setOpen(true);
      void reason; // reason is for future telemetry hooks only — never sent anywhere today.
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      engagedMsRef.current += 1000;
      if (engagedMsRef.current >= ENGAGED_THRESHOLD_MS && holdsRef.current.size === 0) {
        tryOpen("timer");
      }
    }, 1000);

    function handleContextualRequest() {
      tryOpen("contextual");
    }
    window.addEventListener(REGISTRATION_PROMPT_REQUEST_EVENT, handleContextualRequest);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(REGISTRATION_PROMPT_REQUEST_EVENT, handleContextualRequest);
    };
    // Deliberately no `pathname` in the dependency array beyond what's
    // already captured by `tryOpen`'s closure reading the latest value on
    // each tick — re-running this whole effect on every route change
    // would reset the interval and lose accumulated engaged time, which
    // is exactly the "not retriggered on navigation" behavior the brief
    // asks for. `pathname`/`user` are read fresh inside the interval
    // callback's closure each tick via the outer scope, not restarted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // NW08.7 — listen for holds from mount (independently of auth readiness) so a hold raised during page load is never missed.
  useEffect(() => {
    function handleHold(event: Event) {
      holdsRef.current = applyRegistrationPromptHold(holdsRef.current, (event as CustomEvent<RegistrationPromptHoldDetail>).detail);
    }
    window.addEventListener(REGISTRATION_PROMPT_HOLD_EVENT, handleHold);
    return () => window.removeEventListener(REGISTRATION_PROMPT_HOLD_EVENT, handleHold);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Fires on Escape (native <dialog> "cancel" -> "close") and on our own
    // close()/handleDismiss() calls — keep `open` state in sync either way.
    const handleClose = () => setOpen(false);
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  function handleDismiss() {
    setDismissedUntilMs(computeDismissUntil(Date.now()));
    setOpen(false);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      className="fixed inset-0 m-auto w-[min(92vw,30rem)] rounded-[var(--radius-card)] border border-border bg-surface p-0 shadow-lifted backdrop:bg-primary-dark/40"
    >
      {open ? (
        <div className={FADE_UP_CLASSES}>
          <div className="relative p-6 sm:p-8">
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Close"
              autoFocus
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-alt hover:text-text"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>

            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <Sparkles aria-hidden="true" className="h-5 w-5" />
            </span>

            <h2 id={headingId} className="mt-4 text-xl font-semibold text-primary">
              Explore Freely. Save Your Future.
            </h2>
            <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-text-soft">
              Create your free Nextwise account to save careers, shortlist universities and continue your journey.
            </p>

            <ul className="mt-5 space-y-2.5">
              <li className="flex items-center gap-2.5 text-sm text-text-soft">
                <Bookmark aria-hidden="true" className="h-4 w-4 shrink-0 text-secondary" />
                Save careers you&rsquo;re interested in
              </li>
              <li className="flex items-center gap-2.5 text-sm text-text-soft">
                <GraduationCap aria-hidden="true" className="h-4 w-4 shrink-0 text-secondary" />
                Shortlist universities to come back to
              </li>
              <li className="flex items-center gap-2.5 text-sm text-text-soft">
                <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0 text-secondary" />
                Pick up your journey exactly where you left it
              </li>
            </ul>

            <div className="mt-6 flex flex-col gap-2.5">
              <LinkButton href={`/register?next=${encodeURIComponent(pathname || "/")}`} className="justify-center">
                {WORKSPACE_LINK_LABEL}
              </LinkButton>
              <LinkButton
                href={`/login?next=${encodeURIComponent(pathname || "/")}`}
                variant="outline"
                className="justify-center"
              >
                Sign In
              </LinkButton>
              <button
                type="button"
                onClick={handleDismiss}
                className="mt-1 text-center text-sm font-medium text-muted hover:text-text-soft"
              >
                Continue Exploring
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

/**
 * Re-exported so a future contextual call site (e.g. an anonymous "Save"
 * button) can do `import { requestRegistrationPrompt } from
 * "@/components/registration-prompt/RegistrationPrompt"` without also
 * needing to know the event-bus module exists — a thin, discoverable
 * façade over ./event-bus.ts.
 */
export { requestRegistrationPrompt } from "@/lib/registration-prompt/event-bus";
