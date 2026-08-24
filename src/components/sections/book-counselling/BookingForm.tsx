"use client";

import { useState, type FormEvent } from "react";
import { CalendarCheck, CheckCircle2, Send } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Textarea } from "@/components/forms/Textarea";
import { Checkbox } from "@/components/forms/Checkbox";
import { Button } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { fieldBorder, inputClasses } from "@/components/forms/FormField";
import { cn } from "@/lib/utils";
import { isRequired, isValidEmail, isValidIndianPhone, minLength } from "@/lib/validation";

interface FormState {
  studentName: string;
  guardianName: string;
  email: string;
  phone: string;
  educationLevel: string;
  passingYear: string;
  location: string;
  interest: string;
  preferredLanguage: string;
  contactMethod: string;
  timeRange: string;
  goal: string;
  consent: boolean;
}

const INITIAL_STATE: FormState = {
  studentName: "",
  guardianName: "",
  email: "",
  phone: "",
  educationLevel: "",
  passingYear: "",
  location: "",
  interest: "",
  preferredLanguage: "English",
  contactMethod: "phone",
  timeRange: "",
  goal: "",
  consent: false,
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const CONTACT_METHODS = [
  { value: "phone", label: "Phone call" },
  { value: "video", label: "Video call" },
  { value: "whatsapp", label: "WhatsApp" },
];

const CURRENT_YEAR = new Date().getFullYear();
const PASSING_YEARS = Array.from({ length: 12 }, (_, i) => CURRENT_YEAR - 3 + i);

export function BookingForm() {
  const [values, setValues] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!isRequired(values.studentName)) next.studentName = "Please enter the student's name.";
    if (!isValidEmail(values.email)) next.email = "Enter a valid email address.";
    if (!isValidIndianPhone(values.phone)) next.phone = "Enter a valid 10-digit Indian mobile number.";
    if (!isRequired(values.educationLevel)) next.educationLevel = "Please select the current education level.";
    if (!isRequired(values.passingYear)) next.passingYear = "Please select a graduation/passing year.";
    if (!isRequired(values.location)) next.location = "Please enter your district or current location.";
    if (!isRequired(values.interest)) next.interest = "Please select what you're most interested in.";
    if (!minLength(values.goal, 10)) next.goal = "Tell us a little about your goal — at least 10 characters.";
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
            This is a Milestone 1 demo — your preferences were validated locally but were not transmitted, booked, or
            stored anywhere. Real scheduling will be enabled in a later milestone. Your preferred time is a request,
            not a confirmed appointment.
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
        This booking form is a demo. No appointment is created and nothing is transmitted in this milestone.
      </DemoNotice>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="booking-student-name" label="Student name" required error={errors.studentName}>
          <Input
            id="booking-student-name"
            name="studentName"
            autoComplete="name"
            value={values.studentName}
            onChange={(e) => update("studentName", e.target.value)}
            error={errors.studentName}
          />
        </FormField>

        <FormField id="booking-guardian-name" label="Parent / guardian name" error={errors.guardianName}>
          <Input
            id="booking-guardian-name"
            name="guardianName"
            autoComplete="off"
            value={values.guardianName}
            onChange={(e) => update("guardianName", e.target.value)}
          />
        </FormField>

        <FormField id="booking-email" label="Email address" required error={errors.email}>
          <Input
            id="booking-email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            error={errors.email}
          />
        </FormField>

        <FormField id="booking-phone" label="Phone number" required hint="Indian mobile number" error={errors.phone}>
          <div className="flex gap-2">
            <span
              aria-hidden="true"
              className="flex shrink-0 items-center rounded-[var(--radius-control)] border border-border-strong bg-surface-alt px-3 text-sm font-medium text-text-soft"
            >
              +91
            </span>
            <Input
              id="booking-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="98765 43210"
              className="flex-1"
              value={values.phone}
              onChange={(e) => update("phone", e.target.value)}
              error={errors.phone}
            />
          </div>
        </FormField>

        <FormField id="booking-education-level" label="Current education level" required error={errors.educationLevel}>
          <Select
            id="booking-education-level"
            name="educationLevel"
            value={values.educationLevel}
            onChange={(e) => update("educationLevel", e.target.value)}
            error={errors.educationLevel}
          >
            <option value="">Select one</option>
            <option value="class-10">Class 10 / below</option>
            <option value="class-12">Class 12</option>
            <option value="undergraduate">Undergraduate</option>
            <option value="postgraduate">Postgraduate</option>
            <option value="working">Working professional</option>
            <option value="other">Other</option>
          </Select>
        </FormField>

        <FormField id="booking-passing-year" label="Graduation / passing year" required error={errors.passingYear}>
          <Select
            id="booking-passing-year"
            name="passingYear"
            value={values.passingYear}
            onChange={(e) => update("passingYear", e.target.value)}
            error={errors.passingYear}
          >
            <option value="">Select a year</option>
            {PASSING_YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField id="booking-location" label="Odisha district or current location" required error={errors.location}>
          <Input
            id="booking-location"
            name="location"
            autoComplete="address-level2"
            value={values.location}
            onChange={(e) => update("location", e.target.value)}
            error={errors.location}
          />
        </FormField>

        <FormField id="booking-interest" label="What are you most interested in?" required error={errors.interest}>
          <Select
            id="booking-interest"
            name="interest"
            value={values.interest}
            onChange={(e) => update("interest", e.target.value)}
            error={errors.interest}
          >
            <option value="">Select one</option>
            <option value="career-discovery">Career discovery</option>
            <option value="india-study">Studying in India</option>
            <option value="study-abroad">Studying abroad</option>
            <option value="admission-support">Admission support</option>
            <option value="parent-consultation">Parent consultation</option>
            <option value="not-sure">Not sure yet</option>
          </Select>
        </FormField>

        <FormField id="booking-language" label="Preferred language">
          <Select
            id="booking-language"
            name="preferredLanguage"
            value={values.preferredLanguage}
            onChange={(e) => update("preferredLanguage", e.target.value)}
          >
            <option value="English">English</option>
            <option value="Odia">Odia</option>
            <option value="Hindi">Hindi</option>
          </Select>
        </FormField>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-text-soft">
          Preferred contact method <span className="text-muted font-normal">(optional)</span>
        </legend>
        <div className="flex flex-wrap gap-3">
          {CONTACT_METHODS.map((method) => (
            <label
              key={method.value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                values.contactMethod === method.value
                  ? "border-secondary bg-secondary-light text-secondary-dark"
                  : "border-border-strong text-text-soft hover:bg-surface-alt"
              )}
            >
              <input
                type="radio"
                name="contactMethod"
                value={method.value}
                checked={values.contactMethod === method.value}
                onChange={(e) => update("contactMethod", e.target.value)}
                className="sr-only"
              />
              {method.label}
            </label>
          ))}
        </div>
      </fieldset>

      <FormField
        id="booking-time-range"
        label="Preferred time range"
        hint="This is a preference, not a confirmed appointment slot."
      >
        <select
          id="booking-time-range"
          name="timeRange"
          value={values.timeRange}
          onChange={(e) => update("timeRange", e.target.value)}
          className={cn(inputClasses, fieldBorder(undefined), "appearance-none")}
        >
          <option value="">No preference</option>
          <option value="morning">Morning (9am–12pm)</option>
          <option value="afternoon">Afternoon (12pm–4pm)</option>
          <option value="evening">Evening (4pm–7pm)</option>
        </select>
      </FormField>

      <FormField id="booking-goal" label="Briefly describe your goal" required error={errors.goal}>
        <Textarea
          id="booking-goal"
          name="goal"
          placeholder="For example: I want help comparing engineering options in India versus Germany."
          value={values.goal}
          onChange={(e) => update("goal", e.target.value)}
          error={errors.goal}
        />
      </FormField>

      <Checkbox
        id="booking-consent"
        label="I consent to CareerPath AI contacting me about this counselling request."
        checked={values.consent}
        onChange={(e) => update("consent", e.target.checked)}
        error={errors.consent}
      />

      <div className="rounded-[var(--radius-control)] bg-surface-alt p-4 text-xs text-muted">
        We only ask for what&apos;s needed to plan a helpful conversation — no passport, financial, academic-document, or
        health information is collected here.
      </div>

      <Button type="submit" trailingIcon={<Send aria-hidden="true" className="h-4 w-4" />}>
        <CalendarCheck aria-hidden="true" className="h-4 w-4" />
        Request free counselling
      </Button>
    </form>
  );
}
