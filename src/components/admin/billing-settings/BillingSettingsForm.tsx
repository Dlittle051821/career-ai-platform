"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Textarea } from "@/components/forms/Textarea";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import type { BillingSettings } from "@/types/payments";

export function BillingSettingsForm({
  action,
  defaultValues,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues: BillingSettings | null;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-6">
      <FormError error={state.error} />

      <Card className="space-y-5">
        <h2 className="text-base font-semibold text-primary">Business details</h2>
        <p className="text-sm text-muted">Shown on every invoice and receipt PDF.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="legalEntityName" label="Legal entity name">
            <Input id="legalEntityName" name="legalEntityName" defaultValue={defaultValues?.legalEntityName ?? ""} />
          </FormField>
          <FormField id="supportEmail" label="Support email">
            <Input id="supportEmail" name="supportEmail" type="email" defaultValue={defaultValues?.supportEmail ?? ""} />
          </FormField>
          <FormField id="supportPhone" label="Support phone">
            <Input id="supportPhone" name="supportPhone" defaultValue={defaultValues?.supportPhone ?? ""} />
          </FormField>
        </div>
        <FormField id="businessAddress" label="Business address">
          <Textarea id="businessAddress" name="businessAddress" defaultValue={defaultValues?.businessAddress ?? ""} rows={3} />
        </FormField>
      </Card>

      <Card className="space-y-5">
        <h2 className="text-base font-semibold text-primary">Tax / GST</h2>
        <p className="rounded-[var(--radius-control)] border border-warning/30 bg-warning-light px-3.5 py-2.5 text-xs text-warning">
          No invoice will show GST fields or be labeled a &quot;Tax Invoice&quot; until GSTIN is genuinely set here.
          Never enter a GSTIN unless it has actually been issued to this business by the GST authority.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="gstRegistered" label="GST registered">
            <label className="flex items-center gap-2 text-sm text-text">
              <input type="checkbox" name="gstRegistered" id="gstRegistered" defaultChecked={defaultValues?.gstRegistered ?? false} className="h-4 w-4 rounded border-border-strong" />
              This business is registered for GST
            </label>
          </FormField>
          <FormField id="gstin" label="GSTIN" hint="Exactly 15 alphanumeric characters.">
            <Input id="gstin" name="gstin" defaultValue={defaultValues?.gstin ?? ""} maxLength={15} />
          </FormField>
          <FormField id="defaultTaxRateBps" label="Default tax rate (%)" hint="Applied as the default on new invoice line items — can be overridden per line.">
            <Input id="defaultTaxRateBps" name="defaultTaxRateBps" inputMode="decimal" defaultValue={defaultValues?.defaultTaxRateBps != null ? (defaultValues.defaultTaxRateBps / 100).toString() : ""} placeholder="e.g. 18" />
          </FormField>
        </div>
      </Card>

      <Card>
        <FormField id="invoiceFooterNote" label="Invoice footer note" hint="Shown at the bottom of every invoice/receipt PDF.">
          <Textarea id="invoiceFooterNote" name="invoiceFooterNote" defaultValue={defaultValues?.invoiceFooterNote ?? ""} rows={2} />
        </FormField>
      </Card>

      <SubmitButton>Save billing settings</SubmitButton>
    </form>
  );
}
