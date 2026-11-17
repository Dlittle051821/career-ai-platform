"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, Building2, CircleAlert, CircleCheck, Clock3, Info, RefreshCw, Sparkles, X } from "lucide-react";
import type { UniversityAccessState } from "@/lib/education/university-discovery/access";
import { withDeadline } from "@/lib/async/with-deadline";
import { refreshUniversityAccessAction } from "@/app/(site)/universities/access-actions";

export interface VerifiedOffer {
  planTitle: string;
  /** Already formatted for display. Comes from the approved plan catalogue, never typed here. */
  priceLabel: string;
  checkoutHref: string;
  /** False while paid checkout is switched off for the site; the purchase action is then shown as unavailable. */
  purchaseAvailable: boolean;
}

interface VerifiedAccessDialogProps {
  accessState: UniversityAccessState;
  offer: VerifiedOffer;
  /** Where the visitor wanted to go; preserved through sign-up, sign-in and re-authentication. */
  returnTo: string;
  triggerLabel: string;
  triggerVariant?: "white" | "coral" | "navy";
}

const BENEFITS = [
  { icon: Building2, label: "Explore the Nextwise University Directory." },
  { icon: Sparkles, label: "Discover university strengths and campus information." },
  { icon: Bookmark, label: "Save universities to your personal dashboard." },
] as const;

/**
 * Nextwise Verified access dialog (University Discovery V3: the one approved
 * improvement over the concept video).
 *
 * Every state shown here is the account's REAL state, decided on the server
 * and passed in as `accessState`. Nothing is inferred from animation timing,
 * and no "signed in" or "entitlement active" badge is ever shown for an
 * account that is not. A native <dialog> gives modal semantics, focus
 * trapping and Escape-to-close; focus returns to the trigger on close.
 */
/** What the dialog is showing: the account's real state, or one of two states only the browser can observe. */
export type DialogViewState = UniversityAccessState | "session_expired" | "error";

/** How long the account check may take before the dialog stops waiting and says so. */
const CHECK_TIMEOUT_MS = 8000;

/**
 * Pure: which view to show after a fresh account check.
 * `rendered` is the state the server rendered the page with; `fresh` is the
 * state the server reports now. A page rendered for a signed-in account that
 * now reads as anonymous means the session ended while the page was open.
 */
export function reconcileAccessState(rendered: UniversityAccessState, fresh: UniversityAccessState): DialogViewState {
  if (rendered !== "anonymous" && fresh === "anonymous") return "session_expired";
  return fresh;
}

export function VerifiedAccessDialog({ accessState, offer, returnTo, triggerLabel, triggerVariant = "white" }: VerifiedAccessDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef(0);
  const titleId = useId();
  const descId = useId();
  const [viewState, setViewState] = useState<DialogViewState>(accessState);
  const [checking, setChecking] = useState(false);

  /** Asks the server for the account's current state. Always settles: success, failure or timeout. */
  const check = useCallback(async () => {
    const request = ++requestRef.current;
    setChecking(true);
    try {
      const { state } = await withDeadline(refreshUniversityAccessAction(), CHECK_TIMEOUT_MS);
      if (request === requestRef.current) setViewState(reconcileAccessState(accessState, state));
    } catch {
      if (request === requestRef.current) setViewState("error");
    } finally {
      if (request === requestRef.current) setChecking(false);
    }
  }, [accessState]);

  const open = useCallback(() => {
    dialogRef.current?.showModal();
    void check();
  }, [check]);
  const close = useCallback(() => dialogRef.current?.close(), []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      requestRef.current += 1; // a late answer must not update a closed dialog
      setChecking(false);
      triggerRef.current?.focus();
    };
    const onBackdrop = (event: MouseEvent) => {
      if (event.target === dialog) dialog.close();
    };
    dialog.addEventListener("close", onClose);
    dialog.addEventListener("click", onBackdrop);
    return () => {
      dialog.removeEventListener("close", onClose);
      dialog.removeEventListener("click", onBackdrop);
    };
  }, []);

  const next = encodeURIComponent(returnTo);
  const bookHref = "/book-counselling";
  const view = resolveView(viewState, offer, next);
  const StatusIcon = view.statusIcon === "clock" ? Clock3 : view.statusIcon === "alert" ? CircleAlert : view.statusIcon === "check" ? CircleCheck : Info;

  return (
    <>
      <button ref={triggerRef} type="button" className="ud-btn" data-variant={triggerVariant} onClick={open} aria-haspopup="dialog">
        {triggerLabel}
        <ArrowRight aria-hidden="true" />
      </button>
      <dialog ref={dialogRef} className="ud-dialog" aria-labelledby={titleId} aria-describedby={descId} data-state={viewState}>
        <div className="ud-dialog-grid">
          <div className="ud-dialog-side">
            <span className="ud-kicker">Nextwise Verified</span>
            <h2>
              {["Your universities.", "Your shortlist.", "Your next step."].map((line, index) => (
                <span key={line} style={{ "--i": index } as React.CSSProperties}>{line}</span>
              ))}
            </h2>
            <div className="ud-dialog-rule" aria-hidden="true" />
            <ul className="ud-benefits">
              {BENEFITS.map(({ icon: Icon, label }, index) => (
                <li key={label} style={{ "--i": index } as React.CSSProperties}><i aria-hidden="true"><Icon /></i>{label}</li>
              ))}
            </ul>
          </div>
          <div className="ud-dialog-main">
            <button type="button" className="ud-dialog-close" onClick={close} aria-label="Close">
              <X aria-hidden="true" />
            </button>
            <h3 id={titleId}>{view.title}</h3>
            <p id={descId}>{view.body}</p>
            {view.showPrice ? (
              <div className="ud-price">
                <div><b>{offer.planTitle}</b><span>Final price, inclusive of applicable GST.</span></div>
                <em>{offer.priceLabel}</em>
              </div>
            ) : null}
            <div aria-live="polite">
              {view.status ? (
                <div className="ud-dialog-status" role="status" data-tone={view.statusIcon}>
                  <StatusIcon aria-hidden="true" />
                  <span>{view.status}</span>
                </div>
              ) : null}
              {checking ? <p className="ud-dialog-note" data-checking>Checking your account…</p> : null}
            </div>
            {viewState === "anonymous" ? (
              <p className="ud-dialog-note">
                Already have an account? <Link href={`/login?next=${next}`}>Log in</Link> and we will bring you straight back here.
              </p>
            ) : null}
            {view.showCourseNote ? (
              <p className="ud-dialog-note">Course discovery continues on official portals. Your first discovery session is always free.</p>
            ) : null}
            <div className="ud-dialog-actions">
              {view.primary.kind === "link" ? (
                <Link href={view.primary.href} className="ud-btn" data-variant="coral">{view.primary.label}</Link>
              ) : view.primary.kind === "retry" ? (
                <button type="button" className="ud-btn" data-variant="coral" onClick={() => void check()} disabled={checking}>
                  <RefreshCw aria-hidden="true" />
                  {checking ? "Checking…" : view.primary.label}
                </button>
              ) : (
                <button type="button" className="ud-btn" data-variant="coral" disabled aria-disabled="true">{view.primary.label}</button>
              )}
              <Link href={bookHref} className="ud-btn" data-variant="line">Book a Free Discovery Session</Link>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}

type PrimaryAction = { kind: "link"; label: string; href: string } | { kind: "unavailable"; label: string } | { kind: "retry"; label: string };

interface DialogView {
  title: string;
  body: string;
  showPrice: boolean;
  showCourseNote: boolean;
  status: string | null;
  statusIcon: "info" | "clock" | "alert" | "check";
  primary: PrimaryAction;
}

const OFFER_BODY =
  "Explore our curated university directory, discover what makes institutions distinctive, and save universities you are interested in.";

/**
 * Pure: the copy and the one primary action for each of the eight states.
 * No state offers an action the account is not entitled to: a purchase link
 * exists only when paid checkout is switched on, and "Explore Universities"
 * only for an account the server reports as entitled.
 */
export function resolveView(state: DialogViewState, offer: VerifiedOffer, encodedReturnTo: string): DialogView {
  switch (state) {
    case "anonymous":
      return {
        title: "Unlock your next step with Nextwise Verified.",
        body: OFFER_BODY,
        showPrice: true,
        showCourseNote: true,
        status: "You need a Nextwise account before you can get Verified. Creating one is free.",
        statusIcon: "info",
        primary: { kind: "link", label: "Create your free account", href: `/register?next=${encodedReturnTo}` },
      };
    case "signed_in_free":
      return {
        title: "Unlock your next step with Nextwise Verified.",
        body: OFFER_BODY,
        showPrice: true,
        showCourseNote: true,
        status: offer.purchaseAvailable ? null : "Online purchase is not open yet. Book a free discovery session and our team will help you get Verified.",
        statusIcon: "info",
        primary: offer.purchaseAvailable
          ? { kind: "link", label: "Continue with Nextwise Verified", href: offer.checkoutHref }
          : { kind: "unavailable", label: "Purchase opening soon" },
      };
    case "payment_pending":
      return {
        title: "Your Verified payment is not complete yet.",
        body: "We open the university directory as soon as your payment is confirmed. You can check its status on your payments page.",
        showPrice: false,
        showCourseNote: false,
        status: "Access is granted only after a confirmed payment.",
        statusIcon: "clock",
        primary: { kind: "link", label: "View my payments", href: "/payments" },
      };
    case "payment_failed":
      return {
        title: "Your last Verified payment did not go through.",
        body: "The most recent payment attempt was not completed, so the university directory is still locked. Your payments page shows what happened and what you can do next.",
        showPrice: false,
        showCourseNote: false,
        status: "Access is granted only after a confirmed payment. If money left your account, contact us before trying again.",
        statusIcon: "alert",
        primary: { kind: "link", label: "View my payments", href: "/payments" },
      };
    case "verified":
      return {
        title: "You're verified. Your university directory is ready.",
        body: "Browse universities, see what each is known for and build your shortlist.",
        showPrice: false,
        showCourseNote: false,
        status: "Nextwise Verified is active on your account.",
        statusIcon: "check",
        primary: { kind: "link", label: "Explore Universities", href: "/universities" },
      };
    case "verified_by_grant":
      return {
        title: "Your Verified access is active.",
        body: "The Nextwise team has opened the university directory on your account. Browse universities, see what each is known for and build your shortlist.",
        showPrice: false,
        showCourseNote: false,
        status: "Access granted by the Nextwise team. No payment was taken for it.",
        statusIcon: "check",
        primary: { kind: "link", label: "Explore Universities", href: "/universities" },
      };
    case "admin":
      return {
        title: "You have staff access to the university directory.",
        body: "This account is a Nextwise staff account. The student offer does not apply to it.",
        showPrice: false,
        showCourseNote: false,
        status: null,
        statusIcon: "info",
        primary: { kind: "link", label: "Explore Universities", href: "/universities" },
      };
    case "session_expired":
      return {
        title: "Your session has ended.",
        body: "For your security you have been signed out. Log in again and we will bring you straight back to this page.",
        showPrice: false,
        showCourseNote: false,
        status: "Nothing on your account has changed.",
        statusIcon: "info",
        primary: { kind: "link", label: "Log in again", href: `/login?next=${encodedReturnTo}` },
      };
    case "error":
      return {
        title: "We couldn't check your account just now.",
        body: "This is usually a brief connection problem. Nothing has changed on your account, and nothing has been charged.",
        showPrice: false,
        showCourseNote: false,
        status: "Check your connection, then try again.",
        statusIcon: "alert",
        primary: { kind: "retry", label: "Try again" },
      };
  }
}
