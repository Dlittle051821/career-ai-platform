"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/supabase/auth-errors";
import { isValidPassword } from "@/lib/validation";

type SessionState = "checking" | "ready" | "invalid";

export function ResetPasswordForm() {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // The /auth/callback route exchanges the emailed recovery code for a
    // session before redirecting here — by the time this component mounts,
    // getUser() should succeed if (and only if) the link was valid and
    // unexpired.
    const supabase = createClient();
    supabase.auth.getUser().then(({ data, error }) => {
      setSessionState(!error && data.user ? "ready" : "invalid");
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setFormError(null);
    if (!isValidPassword(password)) {
      setFieldError("Use at least 8 characters, including a letter and a number.");
      return;
    }
    if (password !== confirmPassword) {
      setFieldError("Passwords don't match.");
      return;
    }
    setFieldError(undefined);

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setFormError(friendlyAuthError(error));
        return;
      }

      setSuccess(true);
    } catch (err) {
      setFormError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (sessionState === "checking") {
    return (
      <div className="flex items-center justify-center py-6 text-muted">
        <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (sessionState === "invalid") {
    return (
      <div role="alert" className="space-y-4 text-center">
        <p className="text-sm leading-relaxed text-error">
          This password reset link is invalid or has expired. Please request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block font-medium text-secondary-dark underline underline-offset-2"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div role="status" className="space-y-4 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-light text-success">
          <CheckCircle2 aria-hidden="true" className="h-6 w-6" />
        </span>
        <div>
          <p className="text-base font-semibold text-primary">Password updated</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Your password has been changed. You can now log in with your new password.
          </p>
        </div>
        <Button className="w-full justify-center" onClick={() => router.push("/login")}>
          Go to login
        </Button>
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

      <FormField id="reset-password" label="New password" required hint="At least 8 characters, with a letter and a number" error={fieldError}>
        <div className="relative">
          <Input
            id="reset-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldError}
            disabled={submitting}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
          </button>
        </div>
      </FormField>

      <FormField id="reset-password-confirm" label="Confirm new password" required>
        <Input
          id="reset-password-confirm"
          name="confirmPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={submitting}
        />
      </FormField>

      <Button
        type="submit"
        className="w-full justify-center"
        disabled={submitting}
        trailingIcon={
          submitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <KeyRound aria-hidden="true" className="h-4 w-4" />
        }
      >
        {submitting ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
