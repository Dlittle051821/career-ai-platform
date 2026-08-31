"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Textarea } from "@/components/forms/Textarea";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import { PRICING_TAX_STATUSES, PRICING_TAX_STATUS_LABELS, type PricingPlanVersion, type PricingServiceItem, type PricingTaxStatus } from "@/types/pricing";

interface ServiceRow {
  key: string;
  label: string;
  description: string;
}

let rowCounter = 0;
function newRow(partial: Partial<ServiceRow> = {}): ServiceRow {
  rowCounter += 1;
  return { key: `svc-${rowCounter}`, label: "", description: "", ...partial };
}

function rowsFromItems(items: PricingServiceItem[]): ServiceRow[] {
  if (items.length === 0) return [];
  return items.map((it) => newRow({ label: it.label, description: it.description ?? "" }));
}

/** Dynamic add/remove-row editor for one PricingServiceItem[] field — reused for both included services and exclusions. Submits as repeated `${namePrefix}Label[]`/`${namePrefix}Description[]` fields, aligned by index — see src/lib/supabase/admin/pricing.ts's parseServiceItemsForm(). */
function ServiceItemsEditor({ title, hint, namePrefix, initialItems, addLabel }: { title: string; hint: string; namePrefix: "service" | "exclusion"; initialItems: PricingServiceItem[]; addLabel: string }) {
  const [rows, setRows] = useState<ServiceRow[]>(() => rowsFromItems(initialItems));

  function updateRow(key: string, field: "label" | "description", value: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }
  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  return (
    <div>
      <p className="text-sm font-semibold text-primary">{title}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
      <div className="mt-3 space-y-3">
        {rows.map((row, index) => (
          <div key={row.key} className="grid gap-2 sm:grid-cols-[1fr_1fr_36px] sm:items-end">
            <FormField id={`${namePrefix}Label-${row.key}`} label={index === 0 ? "Label" : ""}>
              <Input id={`${namePrefix}Label-${row.key}`} name={`${namePrefix}Label`} value={row.label} onChange={(e) => updateRow(row.key, "label", e.target.value)} placeholder="e.g. Two 1:1 counselling sessions" />
            </FormField>
            <FormField id={`${namePrefix}Description-${row.key}`} label={index === 0 ? "Detail (optional)" : ""}>
              <Input id={`${namePrefix}Description-${row.key}`} name={`${namePrefix}Description`} value={row.description} onChange={(e) => updateRow(row.key, "description", e.target.value)} />
            </FormField>
            <button
              type="button"
              onClick={() => removeRow(row.key)}
              aria-label="Remove item"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] text-error hover:bg-error-light"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addRow} icon={<Plus aria-hidden="true" className="h-4 w-4" />}>
        {addLabel}
      </Button>
    </div>
  );
}

/**
 * Create/edit form for a pricing_plan_versions DRAFT row. Only ever
 * rendered for a version whose status is "draft" (see the [id]/page.tsx and
 * versions/[versionId]/page.tsx callers) — once published, the database's
 * own immutability trigger rejects any edit regardless of what this form
 * submits, so a new version is always a fresh instance of this same
 * component instead.
 */
export function PricingPlanVersionForm({
  action,
  currency,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  currency: string;
  defaultValues?: Partial<PricingPlanVersion>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-6">
      <FormError error={state.error} />

      <Card className="space-y-5">
        <p className="rounded-[var(--radius-control)] border border-border-strong bg-surface-alt px-4 py-3 text-sm text-text-soft">
          This becomes an immutable snapshot the moment you publish it — editing anything afterward means creating a
          new version instead. Nothing here is invented for you: leave included services/exclusions empty and the
          public pricing page shows &ldquo;Contact NextWise for the detailed service scope.&rdquo; instead.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="publicTitle" label="Public title" required hint="What students see. For a temporary Bachelor/Master Abroad tier name, this is where you rename it.">
            <Input id="publicTitle" name="publicTitle" defaultValue={defaultValues?.publicTitle} required />
          </FormField>
          <FormField id="amount" label={`Price (${currency}, major units)`} required hint="e.g. 25000 for ₹25,000. Stored as integer minor units.">
            <Input id="amount" name="amount" inputMode="decimal" defaultValue={defaultValues?.amountMinorUnits != null ? String(defaultValues.amountMinorUnits / 100) : ""} required />
          </FormField>
          <FormField id="currency" label="Currency">
            <Input id="currency" name="currency" defaultValue={currency} maxLength={3} />
          </FormField>
          <FormField id="ctaText" label="Call-to-action text" hint='Defaults to "Get started" if left blank.'>
            <Input id="ctaText" name="ctaText" defaultValue={defaultValues?.ctaText ?? ""} />
          </FormField>
          <FormField id="taxStatus" label="Tax status" hint="Descriptive only — see docs/nextwise-pricing-offers-guide.md §9. Tax is only ever added when billing settings actually configure a GST rate.">
            <Select id="taxStatus" name="taxStatus" defaultValue={defaultValues?.taxStatus ?? "unconfigured"}>
              {PRICING_TAX_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PRICING_TAX_STATUS_LABELS[s as PricingTaxStatus]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="effectiveFrom" label="Effective from" hint="Leave blank for immediately upon publishing. Set a future date to schedule/publish future pricing.">
            <Input id="effectiveFrom" name="effectiveFrom" type="datetime-local" defaultValue={defaultValues?.effectiveFrom ? defaultValues.effectiveFrom.slice(0, 16) : ""} />
          </FormField>
          <FormField id="effectiveUntil" label="Effective until" hint="Leave blank for no scheduled end.">
            <Input id="effectiveUntil" name="effectiveUntil" type="datetime-local" defaultValue={defaultValues?.effectiveUntil ? defaultValues.effectiveUntil.slice(0, 16) : ""} />
          </FormField>
        </div>

        <FormField id="shortDescription" label="Short description" hint="One line, shown on the pricing card.">
          <Input id="shortDescription" name="shortDescription" defaultValue={defaultValues?.shortDescription ?? ""} />
        </FormField>
        <FormField id="detailedDescription" label="Detailed description" hint="Shown on the plan's expanded view.">
          <Textarea id="detailedDescription" name="detailedDescription" defaultValue={defaultValues?.detailedDescription ?? ""} rows={4} />
        </FormField>

        <ServiceItemsEditor
          title="Included services (approved benefits, unstructured)"
          hint='Legacy free-text list — prefer the structured "Inclusions" manager below (available once this version has been saved) for anything that should show as its own line with an order and an optional highlight. Leave empty until you have real copy.'
          namePrefix="service"
          initialItems={defaultValues?.includedServices ?? []}
          addLabel="Add included service"
        />
        <ServiceItemsEditor
          title="Exclusions"
          hint="University, visa, test, translation, courier, government, and other third-party fees are already noted as excluded by default on the public page — only add something here if it differs from that default."
          namePrefix="exclusion"
          initialItems={defaultValues?.exclusions ?? []}
          addLabel="Add exclusion"
        />
      </Card>

      <Card className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-primary">Presentation &amp; comparison-table settings</p>
          <p className="mt-1 text-xs text-muted">
            Shown prominently on the public pricing card (session count) and in the Bachelor/Master Abroad comparison
            table. Leave any field blank if the plan&rsquo;s approved copy gives no clean number for it — the public
            page shows &ldquo;&mdash;&rdquo; rather than a guess.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="sessionCount" label="Counselling sessions" hint="Number of individual sessions included.">
            <Input id="sessionCount" name="sessionCount" inputMode="numeric" defaultValue={defaultValues?.sessionCount ?? ""} />
          </FormField>
          <FormField id="sessionDurationNote" label="Session duration note" hint='e.g. "Each session lasts approximately 45–60 minutes".'>
            <Input id="sessionDurationNote" name="sessionDurationNote" defaultValue={defaultValues?.sessionDurationNote ?? ""} />
          </FormField>
          <FormField id="audienceLabel" label="Recommended audience" hint='e.g. "Classes 8–10". Leave blank if not applicable.'>
            <Input id="audienceLabel" name="audienceLabel" defaultValue={defaultValues?.audienceLabel ?? ""} />
          </FormField>
          <FormField id="counsellorTier" label="Counsellor tier" hint='e.g. "Dedicated counsellor", "Senior dedicated counsellor". Leave blank if not mentioned.'>
            <Input id="counsellorTier" name="counsellorTier" defaultValue={defaultValues?.counsellorTier ?? ""} />
          </FormField>
          <FormField id="universityShortlistLimit" label="University shortlist limit" hint="Comparison table.">
            <Input id="universityShortlistLimit" name="universityShortlistLimit" inputMode="numeric" defaultValue={defaultValues?.universityShortlistLimit ?? ""} />
          </FormField>
          <FormField id="applicationSupportLimit" label="Application support limit" hint="Comparison table.">
            <Input id="applicationSupportLimit" name="applicationSupportLimit" inputMode="numeric" defaultValue={defaultValues?.applicationSupportLimit ?? ""} />
          </FormField>
          <FormField id="sopReviewRounds" label="SOP review rounds" hint="Comparison table.">
            <Input id="sopReviewRounds" name="sopReviewRounds" inputMode="numeric" defaultValue={defaultValues?.sopReviewRounds ?? ""} />
          </FormField>
          <FormField id="mockInterviewCount" label="Mock interviews" hint="Comparison table. Leave blank if the copy gives no fixed count.">
            <Input id="mockInterviewCount" name="mockInterviewCount" inputMode="numeric" defaultValue={defaultValues?.mockInterviewCount ?? ""} />
          </FormField>
          <FormField id="scholarshipSupportNote" label="Scholarship support" hint='Free text, e.g. "Basic scholarship search".'>
            <Input id="scholarshipSupportNote" name="scholarshipSupportNote" defaultValue={defaultValues?.scholarshipSupportNote ?? ""} />
          </FormField>
          <FormField id="supportDurationNote" label="Support duration" hint='e.g. "90 days of email or WhatsApp support", "Up to 12 months".'>
            <Input id="supportDurationNote" name="supportDurationNote" defaultValue={defaultValues?.supportDurationNote ?? ""} />
          </FormField>
        </div>
      </Card>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
