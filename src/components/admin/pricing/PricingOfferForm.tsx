"use client";

import { useActionState, useState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Textarea } from "@/components/forms/Textarea";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import type { PricingOffer } from "@/types/pricing";

/** en-IN "YYYY-MM-DDTHH:mm" for a datetime-local input's defaultValue, mirroring the effectiveFrom/effectiveUntil pattern in PricingPlanVersionForm. */
function toLocalInputValue(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 16) : "";
}

/**
 * Create/edit form for a pricing_offers row. Always creates/keeps status
 * "draft" and is_active=false — publishing and activating are separate,
 * deliberate workflow steps (see PricingOfferWorkflowCard), per the spec's
 * "no offer active by default" requirement. Field names match
 * parseOfferForm() in src/lib/supabase/admin/pricing.ts exactly.
 */
export function PricingOfferForm({
  action,
  planCurrency,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  planCurrency: string;
  defaultValues?: Partial<PricingOffer>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const [discountType, setDiscountType] = useState<"fixed" | "percentage">(defaultValues?.discountType ?? "percentage");

  return (
    <form action={formAction} className="space-y-6">
      <FormError error={state.error} />

      <Card className="space-y-5">
        <p className="rounded-[var(--radius-control)] border border-border-strong bg-surface-alt px-4 py-3 text-sm text-text-soft">
          Saving here never makes this offer live — it stays a draft, unpublished and inactive, until you explicitly
          publish and activate it from the offer&apos;s workflow controls. Nothing is invented: there is no default
          discount, coupon code, or expiry — you must set every value yourself.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="publicOfferName" label="Public offer name" required hint="Shown to students wherever this offer applies.">
            <Input id="publicOfferName" name="publicOfferName" defaultValue={defaultValues?.publicOfferName} required />
          </FormField>
          <FormField id="couponCode" label="Coupon code (optional)" hint="Leave blank for an offer that applies automatically with no code.">
            <Input id="couponCode" name="couponCode" defaultValue={defaultValues?.couponCode ?? ""} className="uppercase" />
          </FormField>
        </div>

        <FormField id="internalDescription" label="Internal notes (admin-only)">
          <Textarea id="internalDescription" name="internalDescription" defaultValue={defaultValues?.internalDescription ?? ""} rows={2} />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="discountType" label="Discount type" required>
            <Select
              id="discountType"
              name="discountType"
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as "fixed" | "percentage")}
              required
            >
              <option value="percentage">Percentage off</option>
              <option value="fixed">Fixed amount off</option>
            </Select>
          </FormField>

          {discountType === "percentage" ? (
            <FormField id="discountPercent" label="Discount percent" required hint="Greater than 0, no more than 100.">
              <Input
                id="discountPercent"
                name="discountPercent"
                inputMode="decimal"
                defaultValue={defaultValues?.discountPercentBps != null ? String(defaultValues.discountPercentBps / 100) : ""}
                required
              />
            </FormField>
          ) : (
            <FormField id="discountAmount" label={`Discount amount (${planCurrency}, major units)`} required hint="Cannot exceed the plan's price.">
              <Input
                id="discountAmount"
                name="discountAmount"
                inputMode="decimal"
                defaultValue={defaultValues?.discountAmountMinorUnits != null ? String(defaultValues.discountAmountMinorUnits / 100) : ""}
                required
              />
              <input type="hidden" name="discountCurrency" value={defaultValues?.discountCurrency ?? planCurrency} />
            </FormField>
          )}

          <FormField id="startsAt" label="Starts at" required>
            <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={toLocalInputValue(defaultValues?.startsAt)} required />
          </FormField>
          <FormField id="endsAt" label="Ends at" required>
            <Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={toLocalInputValue(defaultValues?.endsAt)} required />
          </FormField>

          <FormField id="maxRedemptions" label="Max total redemptions (optional)" hint="Leave blank for unlimited.">
            <Input id="maxRedemptions" name="maxRedemptions" inputMode="numeric" defaultValue={defaultValues?.maxRedemptions != null ? String(defaultValues.maxRedemptions) : ""} />
          </FormField>
          <FormField id="perUserLimit" label="Per-student limit (optional)" hint="Leave blank for unlimited.">
            <Input id="perUserLimit" name="perUserLimit" inputMode="numeric" defaultValue={defaultValues?.perUserLimit != null ? String(defaultValues.perUserLimit) : ""} />
          </FormField>
        </div>
      </Card>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
