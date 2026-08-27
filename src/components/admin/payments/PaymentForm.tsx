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
import { nextStatusOptions, PAYMENT_STATUS_TRANSITIONS } from "@/lib/admin/status";
import { PAYMENT_STATUS_LABELS, type Payment, type PaymentStatus } from "@/types/admin";

const REFUND_STATUSES = [
  { value: "none", label: "None" },
  { value: "requested", label: "Requested" },
  { value: "partial", label: "Partial" },
  { value: "full", label: "Full" },
];

export function PaymentForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: Partial<Payment>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const currentStatus = defaultValues?.status;
  const statusOptions: PaymentStatus[] = currentStatus ? [currentStatus, ...nextStatusOptions(PAYMENT_STATUS_TRANSITIONS, currentStatus)] : [];

  return (
    <form action={formAction} className="space-y-6">
      <FormError error={state.error} />

      <Card className="space-y-5">
        <p className="rounded-[var(--radius-control)] border border-warning/30 bg-warning-light px-4 py-3 text-sm text-warning">
          This is operational tracking only, not a payment processor. Recording a &quot;paid&quot; status here does
          not process a transaction.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="studentEmail"
            label="Student email"
            hint={
              defaultValues?.studentName
                ? `Currently linked to ${defaultValues.studentName}. Leave blank to unlink, or enter a different email to relink.`
                : "Optional — a payment can exist before a student is linked."
            }
          >
            <Input id="studentEmail" name="studentEmail" type="email" />
          </FormField>
          <FormField id="invoiceReference" label="Invoice reference">
            <Input id="invoiceReference" name="invoiceReference" defaultValue={defaultValues?.invoiceReference ?? ""} />
          </FormField>
          <FormField id="amount" label="Amount" required hint="Numeric only, e.g. 1500.50">
            <Input
              id="amount"
              name="amount"
              inputMode="decimal"
              required
              defaultValue={defaultValues?.amountMinorUnits != null ? (defaultValues.amountMinorUnits / 100).toString() : ""}
            />
          </FormField>
          <FormField id="currency" label="Currency">
            <Input id="currency" name="currency" defaultValue={defaultValues?.currency ?? "INR"} maxLength={3} />
          </FormField>
          <FormField id="paymentType" label="Payment type">
            <Input id="paymentType" name="paymentType" defaultValue={defaultValues?.paymentType ?? ""} placeholder="e.g. counselling fee, application fee" />
          </FormField>
          <FormField id="paymentMethodLabel" label="Payment method label" hint="A description, not a live payment method.">
            <Input id="paymentMethodLabel" name="paymentMethodLabel" defaultValue={defaultValues?.paymentMethodLabel ?? ""} placeholder="e.g. Bank transfer" />
          </FormField>
          {currentStatus ? (
            <FormField id="status" label="Status">
              <Select id="status" name="status" defaultValue={currentStatus}>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {PAYMENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}
          <FormField id="dueDate" label="Due date">
            <Input id="dueDate" name="dueDate" type="date" defaultValue={defaultValues?.dueDate ?? ""} />
          </FormField>
          <FormField id="paidDate" label="Paid date">
            <Input id="paidDate" name="paidDate" type="date" defaultValue={defaultValues?.paidDate ?? ""} />
          </FormField>
          <FormField id="externalTransactionReference" label="External transaction reference">
            <Input id="externalTransactionReference" name="externalTransactionReference" defaultValue={defaultValues?.externalTransactionReference ?? ""} />
          </FormField>
          <FormField id="refundStatus" label="Refund status">
            <Select id="refundStatus" name="refundStatus" defaultValue={defaultValues?.refundStatus ?? "none"}>
              {REFUND_STATUSES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="refundAmount" label="Refund amount" hint="Numeric only.">
            <Input
              id="refundAmount"
              name="refundAmount"
              inputMode="decimal"
              defaultValue={defaultValues?.refundAmountMinorUnits != null ? (defaultValues.refundAmountMinorUnits / 100).toString() : ""}
            />
          </FormField>
        </div>

        <FormField id="internalNotes" label="Internal notes" hint="Never shown to the student.">
          <Textarea id="internalNotes" name="internalNotes" defaultValue={defaultValues?.internalNotes ?? ""} rows={3} />
        </FormField>
      </Card>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
