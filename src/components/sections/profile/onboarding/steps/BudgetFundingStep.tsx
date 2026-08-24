"use client";

import { FormField } from "@/components/forms/FormField";
import { Select } from "@/components/forms/Select";
import { BUDGET_BAND_OPTIONS, FUNDING_SOURCE_OPTIONS } from "@/data/profile-options";
import { DemoNotice } from "@/components/ui/DemoNotice";
import type { FundingPreferencesInput } from "@/lib/supabase/student-profile-actions";
import { YesNoMaybeToggle } from "../ChipToggleGroup";

interface BudgetFundingStepProps {
  value: FundingPreferencesInput;
  onChange: (next: FundingPreferencesInput) => void;
}

export function BudgetFundingStep({ value, onChange }: BudgetFundingStepProps) {
  function set<K extends keyof FundingPreferencesInput>(key: K, next: FundingPreferencesInput[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="space-y-6">
      <DemoNotice>
        This gives us a rough sense of what&apos;s realistic — we only ask for a budget range, never bank details,
        income documents, or your credit history.
      </DemoNotice>

      <FormField id="budget-band" label="Approximate total education budget" required>
        <Select id="budget-band" value={value.budgetBand ?? ""} onChange={(e) => set("budgetBand", e.target.value || null)}>
          <option value="">Select one</option>
          {BUDGET_BAND_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField id="funding-source" label="Funding source preference" required>
        <Select id="funding-source" value={value.fundingSource ?? ""} onChange={(e) => set("fundingSource", e.target.value || null)}>
          <option value="">Select one</option>
          {FUNDING_SOURCE_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </Select>
      </FormField>

      <div>
        <p className="mb-2.5 text-sm font-medium text-text">Open to an education loan?</p>
        <YesNoMaybeToggle value={value.loanOpenness} onChange={(v) => set("loanOpenness", v)} ariaLabel="Open to an education loan" />
      </div>
    </div>
  );
}
