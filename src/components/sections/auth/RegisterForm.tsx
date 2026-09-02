"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, MailCheck, UserPlus } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Checkbox } from "@/components/forms/Checkbox";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/supabase/auth-errors";
import { isRequired, isValidEmail, isValidIndianPhone, isValidPassword } from "@/lib/validation";
import { trackEventClient } from "@/lib/supabase/analytics/track-client";

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  termsConsent: boolean;
  marketingConsent: boolean;
}

const INITIAL_STATE: FormState = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  termsConsent: false,
  marketingConsent: false,
};

type FormErrors = Partial<Record<keyof FormState, string>>;

export function RegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!isRequired(values.fullName)) next.fullName = "Please enter your full name.";
    if (!isValidEmail(values.email)) next.email = "Enter a valid email address.";
    if (!isValidIndianPhone(values.phone)) next.phone = "Enter a valid 10-digit Indian phone number.";
    if (!isValidPassword(values.password))
      next.password = "Use at least 8 characters, including a letter and a number.";
    if (!values.termsConsent) next.termsConsent = "You need to agree to continue.";
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return; // duplicate-submission guard

    const nextErrors = validate();
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: {
          data: {
            full_name: values.fullName.trim(),
            phone: values.phone.trim(),
            marketing_consent: values.marketingConsent,
          },
          emailRedirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=/welcome` : undefined,
        },
      });

      if (error) {
        setFormError(friendlyAuthError(error));
        return;
      }

      // Fire-and-forget: never awaited, never allowed to affect the
      // redirect/checkEmail branches below — see trackEventClient's own
      // contract (src/lib/supabase/analytics/track-client.ts).
      void trackEventClient({
        eventName: "user_registered",
        source: "register_form",
        path: "/register",
        feature: "auth",
        entityType: "profile",
        entityId: data.user?.id ?? null,
      });

      if (data.session) {
        // Email confirmation is disabled on this Supabase project — the
        // account is immediately active with a live session. Milestone
        // 11-B: land on the Assisted Onboarding choice screen, never
        // straight into a mandatory profile form — see /welcome.
        router.push("/welcome");
        router.refresh();
        return;
      }

      // Email confirmation is required — Supabase created the account but
      // withheld a session until the student clicks the emailed link.
      setCheckEmail(true);
    } catch (err) {
      setFormError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (checkEmail) {
    return (
      <div role="status" className="space-y-4 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-info-light text-info">
          <MailCheck aria-hidden="true" className="h-6 w-6" />
        </span>
        <div>
          <p className="text-base font-semibold text-primary">Check your email</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            We&apos;ve sent a confirmation link to <span className="font-medium text-text">{values.email}</span>.
            Open it on this device to activate your account, then come back and log in.
          </p>
        </div>
        <p className="text-xs text-muted">
          Didn&apos;t get it? Check your spam folder, or{" "}
          <button
            type="button"
            onClick={() => setCheckEmail(false)}
            className="font-medium text-secondary-dark underline underline-offset-2"
          >
            try registering again
          </button>
          .
        </p>
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

      <FormField id="register-name" label="Full name" required error={errors.fullName}>
        <Input
          id="register-name"
          name="fullName"
          autoComplete="name"
          value={values.fullName}
          onChange={(e) => update("fullName", e.target.value)}
          error={errors.fullName}
          disabled={submitting}
        />
      </FormField>

      <FormField id="register-email" label="Email address" required error={errors.email}>
        <Input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => update("email", e.target.value)}
          error={errors.email}
          disabled={submitting}
        />
      </FormField>

      <FormField id="register-phone" label="Phone number" required hint="Indian mobile number" error={errors.phone}>
        <Input
          id="register-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="98765 43210"
          value={values.phone}
          onChange={(e) => update("phone", e.target.value)}
          error={errors.phone}
          disabled={submitting}
        />
      </FormField>

      <FormField id="register-password" label="Password" required hint="At least 8 characters, with a letter and a number" error={errors.password}>
        <div className="relative">
          <Input
            id="register-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => update("password", e.target.value)}
            error={errors.password}
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

      <div className="space-y-3 border-t border-border pt-4">
        <Checkbox
          id="register-terms"
          label={
            <>
              I agree to the{" "}
              <Link href="/terms" className="font-medium text-secondary-dark underline underline-offset-2">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-medium text-secondary-dark underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </>
          }
          checked={values.termsConsent}
          onChange={(e) => update("termsConsent", e.target.checked)}
          error={errors.termsConsent}
          disabled={submitting}
        />
        <Checkbox
          id="register-marketing"
          label="I would like a counselor to contact me about career and study-abroad services."
          checked={values.marketingConsent}
          onChange={(e) => update("marketingConsent", e.target.checked)}
          disabled={submitting}
        />
      </div>

      <Button
        type="submit"
        className="w-full justify-center"
        disabled={submitting}
        trailingIcon={
          submitting ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus aria-hidden="true" className="h-4 w-4" />
          )
        }
      >
        {submitting ? "Creating your account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-secondary-dark underline underline-offset-2">
          Log in
        </Link>
      </p>
    </form>
  );
}
