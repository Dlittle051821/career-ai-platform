"use client";

import { useEffect, useRef, useState } from "react";
import { LogIn, X, Sparkles } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";

/**
 * "Student login" is explicitly out of scope for Milestone 1. Rather than
 * a dead link or a fake login form, this opens a small, honest, accessible
 * dialog explaining that accounts are coming later.
 */
export function StudentLoginModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      setOpen(false);
      document.body.style.overflow = "";
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Student login — coming soon"
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-sm font-medium text-text-soft hover:text-primary"
      >
        <LogIn aria-hidden="true" className="h-4 w-4" />
        <span className="hidden 2xl:inline">Student login</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="student-login-title"
        className="m-auto max-w-sm rounded-[var(--radius-card)] border border-border bg-surface p-0 shadow-lifted backdrop:bg-primary-dark/40"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <Sparkles aria-hidden="true" className="h-5 w-5" />
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close dialog"
              className="rounded-md p-1.5 text-muted hover:bg-surface-alt hover:text-text"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
          <h2 id="student-login-title" className="mt-4 text-lg font-semibold text-primary">
            Student accounts are coming soon
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            We haven&apos;t built student sign-in yet — this milestone focuses on the public website. When accounts
            launch, you&apos;ll be able to track your career discovery, applications, and counselling progress in one
            place.
          </p>
          <p className="mt-4 text-sm text-muted">In the meantime, you can book a free counselling conversation.</p>
          <div className="mt-5">
            <LinkButton href="/book-counselling" size="sm" className="w-full justify-center">
              Book free counselling
            </LinkButton>
          </div>
        </div>
      </dialog>
    </>
  );
}
