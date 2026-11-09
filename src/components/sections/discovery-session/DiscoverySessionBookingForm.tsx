"use client";

import { useState, type FormEvent } from "react";
import { CalendarCheck, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { Select } from "@/components/forms/Select";
import { Textarea } from "@/components/forms/Textarea";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { DISCOVERY_SESSION_CONTACT_METHODS, type DiscoverySessionContactMethod } from "@/types/discovery-session";
import { bookDiscoverySessionAction } from "@/app/(site)/discovery-session/book/actions";

const CONTACT_METHOD_LABELS: Record<DiscoverySessionContactMethod, string> = {
  phone: "Phone call",
  video: "Video call",
  whatsapp: "WhatsApp",
};

interface FormState {
  preferredContactMethod: DiscoverySessionContactMethod;
  preferredTimeRange: string;
  preferredLanguage: string;
  studentNotes: string;
}

const INITIAL_STATE: FormState = {
  preferredContactMethod: "phone",
  preferredTimeRange: "",
  preferredLanguage: "English",
  studentNotes: "",
};

/**
 * Milestone 11-B1 — the REAL Discovery Session booking form (authenticated,
 * writes a discovery_sessions row). Deliberately a separate component from
 * BookingForm.tsx (src/components/sections/book-counselling/), which stays
 * exactly as it was: an explicit Milestone-1 demo for anonymous visitors
 * whose own on-screen copy says nothing is stored — not touched by this
 * milestone at all.
 */
export function DiscoverySessionBookingForm() {
  const [values, setValues] = useState<FormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    let result: Awaited<ReturnType<typeof bookDiscoverySessionAction>>;
    try {
      result = await bookDiscoverySessionAction({
        preferredContactMethod: values.preferredContactMethod,
        preferredTimeRange: values.preferredTimeRange || null,
        preferredLanguage: values.preferredLanguage || null,
        studentNotes: values.studentNotes.trim() || null,
      });
    } catch {
      // CC-22B — a dropped connection (or a deploy in between) used to leave the form stuck on "Booking…".
      setSubmitting(false);
      setError("We couldn't send your request — please check your connection and try again.");
      return;
    }

    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setBooked(true);
  }

  if (booked) {
    return (
      <Card className="flex items-start gap-3 border-success/25 bg-success-light">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-success" />
        <div>
          <p className="text-base font-semibold text-success">Your Discovery Session request is in</p>
          <p className="mt-1 text-sm leading-relaxed text-success">
            This is a request, not a booked slot yet. A Nextwise counsellor will contact you using the method you
            chose to agree a time. Nextwise does not send email or app notifications about it yet, so check back on
            this page for the confirmed time. It&rsquo;s completely free, with no obligation to buy anything.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-success">
            You can&rsquo;t change or cancel a request online yet — if your plans change, tell your counsellor when
            they contact you.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {error ? (
        <p role="alert" className="rounded-[var(--radius-control)] border border-error/25 bg-error-light px-4 py-3 text-sm text-error">
          {error}
        </p>
      ) : null}

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-text-soft">Preferred contact method</legend>
        <div className="flex flex-wrap gap-3">
          {DISCOVERY_SESSION_CONTACT_METHODS.map((method) => (
            <label
              key={method}
              className={cn(
                // CC-22B — the radio itself is visually hidden, so show its keyboard focus on the pill.
                "flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-secondary",
                values.preferredContactMethod === method
                  ? "border-secondary bg-secondary-light text-secondary-dark"
                  : "border-border-strong text-text-soft hover:bg-surface-alt"
              )}
            >
              <input
                type="radio"
                name="preferredContactMethod"
                value={method}
                checked={values.preferredContactMethod === method}
                onChange={(e) => update("preferredContactMethod", e.target.value as DiscoverySessionContactMethod)}
                className="sr-only"
                disabled={submitting}
              />
              {CONTACT_METHOD_LABELS[method]}
            </label>
          ))}
        </div>
      </fieldset>

      <FormField id="preferredTimeRange" label="Preferred time range" hint="This is a preference, not a confirmed appointment slot.">
        <Select
          id="preferredTimeRange"
          name="preferredTimeRange"
          value={values.preferredTimeRange}
          onChange={(e) => update("preferredTimeRange", e.target.value)}
          disabled={submitting}
        >
          <option value="">No preference</option>
          <option value="morning">Morning (9am–12pm)</option>
          <option value="afternoon">Afternoon (12pm–4pm)</option>
          <option value="evening">Evening (4pm–7pm)</option>
        </Select>
      </FormField>

      <FormField id="preferredLanguage" label="Preferred language">
        <Select
          id="preferredLanguage"
          name="preferredLanguage"
          value={values.preferredLanguage}
          onChange={(e) => update("preferredLanguage", e.target.value)}
          disabled={submitting}
        >
          <option value="English">English</option>
          <option value="Odia">Odia</option>
          <option value="Hindi">Hindi</option>
        </Select>
      </FormField>

      <FormField id="studentNotes" label="Anything you'd like the counsellor to know?" hint="Optional — e.g. what you're unsure about, or what you'd like to get out of the conversation.">
        <Textarea
          id="studentNotes"
          name="studentNotes"
          rows={3}
          value={values.studentNotes}
          onChange={(e) => update("studentNotes", e.target.value)}
          disabled={submitting}
        />
      </FormField>

      <div className="flex items-start gap-2 rounded-[var(--radius-control)] bg-surface-alt p-4 text-xs text-muted">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        This is the free first conversation — separate from any paid plan, with no obligation to purchase
        anything. You&rsquo;re sending a request: a counsellor contacts you by your chosen method to agree a time.
        Requests can&rsquo;t be changed or cancelled online yet.
      </div>

      {/* UX10-M01 — the Button component is `inline-flex` by default (shrinks
          to its text), so this primary submit CTA sat as a short pill on
          mobile rather than the full-width "easy to tap" primary action the
          reference mockups show throughout. Scoped to below `sm:` so the
          desktop/tablet inline button is unchanged. */}
      <Button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto"
        trailingIcon={submitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <CalendarCheck aria-hidden="true" className="h-4 w-4" />}
      >
        {submitting ? "Booking…" : "Book my free Discovery Session"}
      </Button>
    </form>
  );
}
