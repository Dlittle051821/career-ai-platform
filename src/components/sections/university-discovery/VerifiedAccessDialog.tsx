"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, Building2, Clock3, Info, Sparkles, X } from "lucide-react";
import type { UniversityAccessState } from "@/lib/education/university-discovery/access";

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
export function VerifiedAccessDialog({ accessState, offer, returnTo, triggerLabel, triggerVariant = "white" }: VerifiedAccessDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  const open = useCallback(() => dialogRef.current?.showModal(), []);
  const close = useCallback(() => dialogRef.current?.close(), []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => triggerRef.current?.focus();
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
  const view = resolveView(accessState, offer, next);

  return (
    <>
      <button ref={triggerRef} type="button" className="ud-btn" data-variant={triggerVariant} onClick={open} aria-haspopup="dialog">
        {triggerLabel}
        <ArrowRight aria-hidden="true" />
      </button>
      <dialog ref={dialogRef} className="ud-dialog" aria-labelledby={titleId} aria-describedby={descId}>
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
            {view.status ? (
              <div className="ud-dialog-status" role="status">
                {view.statusIcon === "clock" ? <Clock3 aria-hidden="true" /> : <Info aria-hidden="true" />}
                <span>{view.status}</span>
              </div>
            ) : null}
            {accessState === "anonymous" ? (
              <p className="ud-dialog-note">
                Already have an account? <Link href={`/login?next=${next}`}>Log in</Link> and we will bring you straight back here.
              </p>
            ) : null}
            <p className="ud-dialog-note">Course discovery continues on official portals. Your first discovery session is always free.</p>
            <div className="ud-dialog-actions">
              {view.primaryHref ? (
                <Link href={view.primaryHref} className="ud-btn" data-variant="coral">{view.primaryLabel}</Link>
              ) : (
                <span className="ud-btn" data-variant="coral" aria-disabled="true" role="link">{view.primaryLabel}</span>
              )}
              <Link href={bookHref} className="ud-btn" data-variant="line">Book a Free Discovery Session</Link>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}

interface DialogView {
  title: string;
  body: string;
  showPrice: boolean;
  status: string | null;
  statusIcon: "info" | "clock";
  primaryLabel: string;
  primaryHref: string | null;
}

const OFFER_BODY =
  "Explore our curated university directory, discover what makes institutions distinctive, and save universities you are interested in.";

export function resolveView(accessState: UniversityAccessState, offer: VerifiedOffer, encodedReturnTo: string): DialogView {
  switch (accessState) {
    case "anonymous":
      return {
        title: "Unlock your next step with Nextwise Verified.",
        body: OFFER_BODY,
        showPrice: true,
        status: "You need a Nextwise account before you can buy Verified. Creating one is free.",
        statusIcon: "info",
        primaryLabel: "Continue with Nextwise Verified",
        primaryHref: `/register?next=${encodedReturnTo}`,
      };
    case "signed_in_free":
      return {
        title: "Unlock your next step with Nextwise Verified.",
        body: OFFER_BODY,
        showPrice: true,
        status: offer.purchaseAvailable ? null : "Online purchase is not open yet. Book a free discovery session and we will help you get started.",
        statusIcon: "info",
        primaryLabel: offer.purchaseAvailable ? "Continue with Nextwise Verified" : "Purchase opening soon",
        primaryHref: offer.purchaseAvailable ? offer.checkoutHref : null,
      };
    case "payment_pending":
      return {
        title: "Your Verified payment is not complete yet.",
        body: "We open the university directory as soon as your payment is confirmed. If a payment did not go through, you can try again from your payments page.",
        showPrice: false,
        status: "Access is granted only after a confirmed payment.",
        statusIcon: "clock",
        primaryLabel: "View my payments",
        primaryHref: "/payments",
      };
    case "verified":
    case "admin":
      return {
        title: "You're verified. Your university directory is ready.",
        body: "Browse universities, see what each is known for and build your shortlist.",
        showPrice: false,
        status: null,
        statusIcon: "info",
        primaryLabel: "Explore Universities",
        primaryHref: "/universities",
      };
  }
}
