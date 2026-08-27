"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import type { InvoiceLineItem } from "@/types/payments";

interface Row {
  key: string;
  description: string;
  quantity: string;
  unitAmount: string;
  discount: string;
  taxRateBps: string;
}

let rowCounter = 0;
function newRow(partial: Partial<Row> = {}): Row {
  rowCounter += 1;
  return { key: `row-${rowCounter}`, description: "", quantity: "1", unitAmount: "", discount: "", taxRateBps: "", ...partial };
}

function rowsFromLineItems(lineItems: InvoiceLineItem[]): Row[] {
  if (lineItems.length === 0) return [newRow()];
  return lineItems.map((li) =>
    newRow({
      description: li.description,
      quantity: String(li.quantity),
      unitAmount: (li.unitAmountMinorUnits / 100).toString(),
      discount: li.discountMinorUnits ? (li.discountMinorUnits / 100).toString() : "",
      taxRateBps: li.taxRateBps != null ? String(li.taxRateBps) : "",
    })
  );
}

/**
 * Client-side dynamic add/remove row editor for an invoice's line items —
 * the only client-heavy piece of the invoicing UI (everything else is
 * plain server-rendered forms). Submits as repeated `lineDescription[]`
 * etc. fields, aligned by array index — see
 * src/lib/supabase/admin/invoices.ts's parseLineItemsForm() for the
 * matching server-side parser. Only rendered while the invoice is a
 * draft — see the [id]/page.tsx caller.
 */
export function LineItemsEditor({
  action,
  currency,
  initialLineItems,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  currency: string;
  initialLineItems: InvoiceLineItem[];
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  const [rows, setRows] = useState<Row[]>(() => rowsFromLineItems(initialLineItems));

  function updateRow(key: string, field: keyof Row, value: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state.error} />

      <Card className="space-y-4">
        <div className="space-y-4">
          {rows.map((row, index) => (
            <div key={row.key} className="grid gap-3 border-b border-border pb-4 last:border-b-0 last:pb-0 sm:grid-cols-[1fr_80px_110px_100px_90px_36px] sm:items-end">
              <FormField id={`lineDescription-${row.key}`} label={index === 0 ? "Description" : ""} required={index === 0}>
                <Input
                  id={`lineDescription-${row.key}`}
                  name="lineDescription"
                  value={row.description}
                  onChange={(e) => updateRow(row.key, "description", e.target.value)}
                  placeholder="e.g. University application fee"
                />
              </FormField>
              <FormField id={`lineQuantity-${row.key}`} label={index === 0 ? "Qty" : ""}>
                <Input
                  id={`lineQuantity-${row.key}`}
                  name="lineQuantity"
                  inputMode="decimal"
                  value={row.quantity}
                  onChange={(e) => updateRow(row.key, "quantity", e.target.value)}
                />
              </FormField>
              <FormField id={`lineUnitAmount-${row.key}`} label={index === 0 ? `Unit (${currency})` : ""}>
                <Input
                  id={`lineUnitAmount-${row.key}`}
                  name="lineUnitAmount"
                  inputMode="decimal"
                  value={row.unitAmount}
                  onChange={(e) => updateRow(row.key, "unitAmount", e.target.value)}
                  placeholder="0.00"
                />
              </FormField>
              <FormField id={`lineDiscount-${row.key}`} label={index === 0 ? "Discount" : ""}>
                <Input
                  id={`lineDiscount-${row.key}`}
                  name="lineDiscount"
                  inputMode="decimal"
                  value={row.discount}
                  onChange={(e) => updateRow(row.key, "discount", e.target.value)}
                  placeholder="0.00"
                />
              </FormField>
              <FormField id={`lineTaxRateBps-${row.key}`} label={index === 0 ? "Tax bps" : ""} hint={index === 0 ? "1800 = 18%" : undefined}>
                <Input
                  id={`lineTaxRateBps-${row.key}`}
                  name="lineTaxRateBps"
                  inputMode="numeric"
                  value={row.taxRateBps}
                  onChange={(e) => updateRow(row.key, "taxRateBps", e.target.value)}
                  placeholder="0"
                />
              </FormField>
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                disabled={rows.length === 1}
                aria-label="Remove line"
                className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] text-error hover:bg-error-light disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addRow} icon={<Plus aria-hidden="true" className="h-4 w-4" />}>
          Add line
        </Button>
      </Card>

      <SubmitButton>Save line items</SubmitButton>
    </form>
  );
}
