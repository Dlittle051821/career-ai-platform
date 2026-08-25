"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/supabase/auth-errors";
import { isRequired, isValidEmail } from "@/lib/validation";

interface FormState {
  email: string;
  password: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [values, setValues] = useState<FormState>({ email: "", password: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(() =>
    searchParams.get("authError")
      ? "That confirmation link is invalid or has expired. Please register again, or log in below if you've already confirmed your email."
      : null
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!isValidEmail(values.email)) next.email = "Enter a valid email address.";
    if (!isRequired(values.password)) next.password = "Please enter your password.";
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
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email.trim(),
        password: values.password,
      });

      if (error) {
        setFormError(friendlyAuthError(error));
        return;
      }

      const next = searchParams.get("next");
      router.push(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch (err) {
      setFormError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError ? (
        <p role="alert" className="rounded-[var(--radius-control)] border border-error/25 bg-error-light px-4 py-3 text-sm text-error">
          {formError}
        </p>
      ) : null}

      <FormField id="login-email" label="Email address" required error={errors.email}>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => update("email", e.target.value)}
          error={errors.email}
          disabled={submitting}
        />
      </FormField>

      <FormField id="login-password" label="Password" required error={errors.password}>
        <div className="relative">
          <Input
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
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

      <div className="text-right">
        <Link href="/forgot-password" className="text-sm font-medium text-secondary-dark underline underline-offset-2">
          Forgot password?
        </Link>
      </div>

      <Button
        type="submit"
        className="w-full justify-center"
        disabled={submitting}
        trailingIcon={
          submitting ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn aria-hidden="true" className="h-4 w-4" />
          )
        }
      >
        {submitting ? "Logging in…" : "Log in"}
      </Button>

      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/register" className="font-medium text-secondary-dark underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </form>
  );
}
