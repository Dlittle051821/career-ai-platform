"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Textarea } from "@/components/forms/Textarea";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";

type BoundAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * NW09.2 — record consent to AI-assisted processing in the consent register.
 * Consent is a RECORD (who, how, evidence reference, date), not a checkbox.
 * Every value is validated again on the server and in
 * staff_record_ai_processing_consent().
 */
export function RecordAiConsentForm({ action, allowFictionalMethod, today }: { action: BoundAction; allowFictionalMethod: boolean; today: string }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-3">
      <FormError error={state.error} />
      <FormField id="consentingParty" label="Who gave consent">
        <Select id="consentingParty" name="consentingParty" defaultValue="" required>
          <option value="" disabled>
            Select…
          </option>
          <option value="student">Student</option>
          <option value="parent_guardian">Parent / guardian</option>
          <option value="student_and_parent_guardian">Student and parent / guardian</option>
        </Select>
      </FormField>
      <FormField id="method" label="How consent was given">
        <Select id="method" name="method" defaultValue="" required>
          <option value="" disabled>
            Select…
          </option>
          <option value="signed_consent_form">Signed consent form</option>
          <option value="recorded_meeting">Recorded meeting</option>
          <option value="written_confirmation">Written confirmation (e.g. email)</option>
          {allowFictionalMethod ? <option value="fictional_test_account">Fictional test account (development only)</option> : null}
        </Select>
      </FormField>
      <FormField id="evidenceReference" label="Evidence reference" hint="Where the evidence is kept — e.g. the signed form's document number or the email's reference. Do not paste personal details.">
        <Input id="evidenceReference" name="evidenceReference" required minLength={3} maxLength={200} />
      </FormField>
      <FormField id="givenOn" label="Date consent was given">
        <Input id="givenOn" name="givenOn" type="date" required max={today} />
      </FormField>
      <FormField id="notes" label="Notes (optional)">
        <Textarea id="notes" name="notes" rows={2} maxLength={500} />
      </FormField>
      <SubmitButton savingLabel="Recording…">Record consent</SubmitButton>
    </form>
  );
}

export function WithdrawAiConsentForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="space-y-2">
      <FormError error={state.error} />
      <FormField id="reason" label="Reason for withdrawal">
        <Textarea id="reason" name="reason" rows={2} required minLength={3} maxLength={500} />
      </FormField>
      <ConfirmSubmitButton confirmLabel="Confirm withdrawal" savingLabel="Withdrawing…">
        Withdraw consent
      </ConfirmSubmitButton>
    </form>
  );
}
