"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Textarea } from "@/components/forms/Textarea";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import { nextStatusOptions, CONTENT_STATUS_TRANSITIONS } from "@/lib/admin/status";
import type { ContentItem, ContentStatus, ContentType } from "@/types/admin";

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "faq", label: "FAQ" },
  { value: "announcement", label: "Announcement" },
  { value: "page_block", label: "Page block" },
];

export function ContentItemForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: Partial<ContentItem>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const currentStatus = defaultValues?.status;
  const statusOptions: ContentStatus[] = currentStatus ? [currentStatus, ...nextStatusOptions(CONTENT_STATUS_TRANSITIONS, currentStatus)] : [];

  return (
    <form action={formAction} className="space-y-6">
      <FormError error={state.error} />

      <Card className="space-y-5">
        <p className="rounded-[var(--radius-control)] border border-border-strong bg-surface-alt px-4 py-3 text-sm text-text-soft">
          Body is always rendered as plain text — no HTML or Markdown is interpreted, so nothing typed here can
          inject a script into a page.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="contentType" label="Content type" required>
            <Select id="contentType" name="contentType" defaultValue={defaultValues?.contentType ?? "faq"} required>
              {CONTENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="slug" label="Slug" required hint="Lowercase letters, numbers, single hyphens.">
            <Input id="slug" name="slug" defaultValue={defaultValues?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
          </FormField>
          <FormField id="contentKey" label="Content key" hint="Optional stable key a page template can look up by.">
            <Input id="contentKey" name="contentKey" defaultValue={defaultValues?.contentKey ?? ""} />
          </FormField>
          <FormField id="locale" label="Locale">
            <Input id="locale" name="locale" defaultValue={defaultValues?.locale ?? "en"} maxLength={10} />
          </FormField>
          <FormField id="sortOrder" label="Sort order">
            <Input id="sortOrder" name="sortOrder" inputMode="numeric" defaultValue={defaultValues?.sortOrder != null ? String(defaultValues.sortOrder) : "0"} />
          </FormField>
          {currentStatus ? (
            <FormField id="status" label="Status">
              <Select id="status" name="status" defaultValue={currentStatus}>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}
        </div>

        <FormField id="title" label="Title" required>
          <Input id="title" name="title" defaultValue={defaultValues?.title} required />
        </FormField>

        <FormField id="body" label="Body" required hint="Plain text or Markdown-style line breaks only — never HTML.">
          <Textarea id="body" name="body" defaultValue={defaultValues?.body ?? ""} rows={8} required />
        </FormField>
      </Card>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
