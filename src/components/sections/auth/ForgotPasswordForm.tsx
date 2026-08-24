"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Loader2, Mail, MailCheck } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/supabase/auth-errors";
import { isValidEmail } from "@/lib/validation";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setFormError(null);
    if (!isValidEmail(email)) {
      setFieldError("Enter a valid email address.");
      return;
    }
    setFieldError(undefined);

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=/reset-password` : undefined,
      });

      if (resetError) {
        setFormError(friendlyAuthError(resetError));
        return;
      }

      // Show the same success state whether or not the email exists —
      // confirming/denying an account's existence here would leak who has
      // registered.
      setSent(true);
    } catch (err) {
      setFormError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="space-y-4 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-info-light text-info">
          <MailCheck aria-hidden="true" className="h-6 w-6" />
        </span>
        <div>
          <p className="text-base font-semibold text-primary">Check your email</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            If an account exists for <span className="font-medium text-text">{email}</span>, we&apos;ve sent a
            password reset link. Open it on this device to choose a new password.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError ? (
        <p role="alert" className="rounded-[var(--radius-control)] border border-error/25 bg-error-light px-4 py-3 text-sm text-error">
          {formError}
        </p>
      ) : null}

      <FormField id="forgot-email" label="Email address" required error={fieldError}>
        <Input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError}
          disabled={submitting}
        />
      </FormField>

      <Button
        type="submit"
        className="w-full justify-center"
        disabled={submitting}
        trailingIcon={
          submitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Mail aria-hidden="true" className="h-4 w-4" />
        }
      >
        {submitting ? "Sending…" : "Send reset link"}
      </Button>

      <p className="text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-secondary-dark underline underline-offset-2">
          Back to log in
        </Link>
      </p>
    </form>
  );
}
