"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Button } from "@/components/ui/Button";
import { isRequired, isValidEmail } from "@/lib/validation";

/**
 * Frontend-only waitlist form. Nothing is transmitted anywhere in
 * Milestone 1 — a valid submission shows an honest demo-completion state.
 */
export function WaitlistForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: { name?: string; email?: string } = {};
    if (!isRequired(name)) nextErrors.name = "Please enter your name.";
    if (!isRequired(email)) nextErrors.email = "Please enter your email.";
    else if (!isValidEmail(email)) nextErrors.email = "Enter a valid email address.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-[var(--radius-card)] border border-success/25 bg-success-light p-5 text-success">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Form preview completed</p>
          <p className="mt-1 text-sm">
            This is a demo — your details were not transmitted or stored anywhere. Online waitlist submission will be
            enabled in a later milestone. In the meantime, you can book a free counselling call.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <FormField id="waitlist-name" label="Your name" required error={errors.name}>
        <Input
          id="waitlist-name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
        />
      </FormField>
      <FormField id="waitlist-email" label="Email address" required error={errors.email}>
        <Input
          id="waitlist-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
      </FormField>
      <Button type="submit" trailingIcon={<Send aria-hidden="true" className="h-4 w-4" />}>
        Join the assessment waitlist
      </Button>
    </form>
  );
}
