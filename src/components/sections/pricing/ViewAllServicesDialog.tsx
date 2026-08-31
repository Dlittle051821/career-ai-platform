"use client";

import { useId, useRef } from "react";
import { X, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { PricingInclusion } from "@/types/pricing";

/**
 * Accessible "View all services" disclosure for a plan's full inclusion
 * list, built on the native <dialog> element rather than a hand-rolled
 * overlay: showModal() gives a real top-layer modal with built-in focus
 * trapping and Escape-to-close for free, and every major browser returns
 * focus to the triggering element on close — this component only adds the
 * one thing the platform does not guarantee (explicitly restoring focus to
 * the invoking button via a ref, so the behavior is certain rather than
 * merely typical). Spec: "Add an accessible 'View all services' disclosure
 * or modal for longer lists" / "keyboard-operable, proper ARIA, focus
 * trap/return".
 */
export function ViewAllServicesDialog({ planTitle, inclusions }: { planTitle: string; inclusions: PricingInclusion[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
    triggerRef.current?.focus();
  }

  if (inclusions.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        className="text-sm font-semibold text-secondary-dark underline decoration-dotted underline-offset-4 hover:text-primary"
      >
        View all services ({inclusions.length})
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onCancel={(e) => {
          // Native Escape-to-close already works via <dialog>'s own
          // `cancel` event — intercepted only to also restore focus
          // explicitly rather than relying on browser-default behavior.
          e.preventDefault();
          close();
        }}
        className="w-full max-w-lg rounded-[var(--radius-card)] border border-border bg-surface p-0 text-text shadow-lifted backdrop:bg-black/50"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-primary">
            {planTitle} — all included services
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="mt-0.5 shrink-0 rounded-full p-1.5 text-muted hover:bg-surface-alt hover:text-text"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <ul className="max-h-[60vh] space-y-3 overflow-y-auto px-6 py-5 text-sm text-text-soft">
          {inclusions.map((item) => (
            <li key={item.id} className="flex items-start gap-2.5">
              {item.isHighlight ? (
                <Star aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 fill-current text-[var(--brand-signal-strong)]" />
              ) : (
                <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
              )}
              <span>
                {item.title}
                {item.explanation ? <span className="block text-xs text-muted">{item.explanation}</span> : null}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-border px-6 py-4">
          <Button type="button" variant="outline" onClick={close} className="w-full justify-center sm:w-auto">
            Close
          </Button>
        </div>
      </dialog>
    </>
  );
}
