"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Textarea } from "@/components/forms/Textarea";
import { Checkbox } from "@/components/forms/Checkbox";
import { Button } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { isRequired, isValidEmail, isValidIndianPhone, minLength } from "@/lib/validation";

interface FormState {
  fullName: string;
  role: string;
  phone: string;
  email: string;
  preferredLanguage: string;
  city: string;
  message: string;
  consent: boolean;
}

const INITIAL_STATE: FormState = {
  fullName: "",
  role: "",
  phone: "",
  email: "",
  preferredLanguage: "English",
  city: "",
  message: "",
  consent: false,
};

type FormErrors = Partial<Record<keyof FormState, string>>;

export function ContactForm() {
  const [values, setValues] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!isRequired(values.fullName)) next.fullName = "Please enter your full name.";
    if (!isRequired(values.role)) next.role = "Please select who you are.";
    if (!isValidIndianPhone(values.phone)) next.phone = "Enter a valid 10-digit Indian phone number.";
    if (!isValidEmail(values.email)) next.email = "Enter a valid email address.";
    if (!isRequired(values.city)) next.city = "Please enter your city or district.";
    if (!minLength(values.message, 10)) next.message = "Tell us a little more — at least 10 characters.";
    if (!values.consent) next.consent = "Please confirm you're okay with us contacting you.";
    return next;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-[var(--radius-card)] border border-success/25 bg-success-light p-6 text-success">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
        <div>
          <p className="text-base font-semibold">Form preview completed</p>
          <p className="mt-1 text-sm leading-relaxed">
            This is a Milestone 1 demo — your message was validated locally but was not transmitted or stored
            anywhere. Online submission will be enabled in a later milestone.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setSubmitted(false)}>
            Fill the form again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <DemoNotice>
        Submitting this form is a demo. Nothing you enter is sent to a server or stored in this milestone.
      </DemoNotice>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="contact-name" label="Full name" required error={errors.fullName}>
          <Input
            id="contact-name"
            name="fullName"
            autoComplete="name"
            value={values.fullName}
            onChange={(e) => update("fullName", e.target.value)}
            error={errors.fullName}
          />
        </FormField>

        <FormField id="contact-role" label="I am a" required error={errors.role}>
          <Select
            id="contact-role"
            name="role"
            value={values.role}
            onChange={(e) => update("role", e.target.value)}
            error={errors.role}
          >
            <option value="">Select one</option>
            <option value="student">Student</option>
            <option value="parent">Parent / Guardian</option>
            <option value="partner">Partner</option>
            <option value="other">Other</option>
          </Select>
        </FormField>

        <FormField id="contact-phone" label="Phone number" required hint="Indian mobile number" error={errors.phone}>
          <Input
            id="contact-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="98765 43210"
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            error={errors.phone}
          />
        </FormField>

        <FormField id="contact-email" label="Email address" required error={errors.email}>
          <Input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            error={errors.email}
          />
        </FormField>

        <FormField id="contact-language" label="Preferred language">
          <Select
            id="contact-language"
            name="preferredLanguage"
            value={values.preferredLanguage}
            onChange={(e) => update("preferredLanguage", e.target.value)}
          >
            <option value="English">English</option>
            <option value="Odia">Odia</option>
            <option value="Hindi">Hindi</option>
          </Select>
        </FormField>

        <FormField id="contact-city" label="City / district" required error={errors.city}>
          <Input
            id="contact-city"
            name="city"
            autoComplete="address-level2"
            value={values.city}
            onChange={(e) => update("city", e.target.value)}
            error={errors.city}
          />
        </FormField>
      </div>

      <FormField id="contact-message" label="Message" required error={errors.message}>
        <Textarea
          id="contact-message"
          name="message"
          value={values.message}
          onChange={(e) => update("message", e.target.value)}
          error={errors.message}
        />
      </FormField>

      <Checkbox
        id="contact-consent"
        label="I consent to being contacted about my enquiry by phone, email, or WhatsApp."
        checked={values.consent}
        onChange={(e) => update("consent", e.target.checked)}
        error={errors.consent}
      />

      <Button type="submit" trailingIcon={<Send aria-hidden="true" className="h-4 w-4" />}>
        Send message
      </Button>
    </form>
  );
}
