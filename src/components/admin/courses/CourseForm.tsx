"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Textarea } from "@/components/forms/Textarea";
import { Checkbox } from "@/components/forms/Checkbox";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FormError } from "@/components/admin/FormError";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/admin/form-state";
import {
  COURSE_DURATION_UNITS,
  COURSE_STUDY_PACES,
  COURSE_TUITION_CATEGORIES,
  EDUCATION_VERIFICATION_STATUSES,
  EDUCATION_VERIFICATION_STATUS_LABELS,
  type Course,
} from "@/types/education";

const DELIVERY_MODES = [
  { value: "", label: "— Not set —" },
  { value: "on_campus", label: "On campus" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
];
const TUITION_PERIODS = [
  { value: "", label: "— Not set —" },
  { value: "per_year", label: "Per year" },
  { value: "per_semester", label: "Per semester" },
  { value: "per_program", label: "Per program" },
  { value: "per_credit", label: "Per credit" },
];
const DATA_QUALITY_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "reviewed", label: "Reviewed" },
  { value: "approved", label: "Approved" },
];

export function CourseForm({
  action,
  defaultValues,
  universityOptions,
  campusOptions = [],
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: Partial<Course>;
  universityOptions: { id: string; name: string }[];
  campusOptions?: { id: string; name: string }[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-6">
      <FormError error={state.error} />

      <Card className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="universityId" label="University" required>
            <Select id="universityId" name="universityId" defaultValue={defaultValues?.universityId ?? ""} required>
              <option value="">— Select a university —</option>
              {universityOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="name" label="Course name" required>
            <Input id="name" name="name" defaultValue={defaultValues?.name} required />
          </FormField>
          <FormField id="slug" label="Slug" required hint="Lowercase letters, numbers, single hyphens.">
            <Input id="slug" name="slug" defaultValue={defaultValues?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
          </FormField>
          <FormField id="educationLevel" label="Education level">
            <Input id="educationLevel" name="educationLevel" defaultValue={defaultValues?.educationLevel ?? ""} placeholder="e.g. Bachelor's" />
          </FormField>
          <FormField id="fieldOfStudy" label="Field of study">
            <Input id="fieldOfStudy" name="fieldOfStudy" defaultValue={defaultValues?.fieldOfStudy ?? ""} />
          </FormField>
          <FormField id="durationText" label="Duration">
            <Input id="durationText" name="durationText" defaultValue={defaultValues?.durationText ?? ""} placeholder="e.g. 4 years" />
          </FormField>
          <FormField id="deliveryMode" label="Delivery mode">
            <Select id="deliveryMode" name="deliveryMode" defaultValue={defaultValues?.deliveryMode ?? ""}>
              {DELIVERY_MODES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="campusLocation" label="Campus location">
            <Input id="campusLocation" name="campusLocation" defaultValue={defaultValues?.campusLocation ?? ""} />
          </FormField>
          <FormField id="intakeInfo" label="Intake info">
            <Input id="intakeInfo" name="intakeInfo" defaultValue={defaultValues?.intakeInfo ?? ""} placeholder="e.g. Fall, Spring" />
          </FormField>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <FormField id="tuitionAmount" label="Tuition amount" hint="Numeric only, e.g. 250000">
            <Input
              id="tuitionAmount"
              name="tuitionAmount"
              inputMode="decimal"
              defaultValue={defaultValues?.tuitionAmountMinorUnits != null ? (defaultValues.tuitionAmountMinorUnits / 100).toString() : ""}
            />
          </FormField>
          <FormField id="tuitionCurrency" label="Currency">
            <Input id="tuitionCurrency" name="tuitionCurrency" defaultValue={defaultValues?.tuitionCurrency ?? "INR"} maxLength={3} />
          </FormField>
          <FormField id="tuitionPeriod" label="Tuition period">
            <Select id="tuitionPeriod" name="tuitionPeriod" defaultValue={defaultValues?.tuitionPeriod ?? ""}>
              {TUITION_PERIODS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField id="entryRequirementsSummary" label="Entry requirements summary" hint="Do not invent guarantees — describe stated requirements only.">
          <Textarea id="entryRequirementsSummary" name="entryRequirementsSummary" defaultValue={defaultValues?.entryRequirementsSummary ?? ""} rows={3} />
        </FormField>

        <FormField id="applicationUrl" label="Application URL" hint="Must start with http:// or https://. This is not a live integration.">
          <Input id="applicationUrl" name="applicationUrl" type="url" defaultValue={defaultValues?.applicationUrl ?? ""} placeholder="https://" />
        </FormField>

        <FormField id="dataQualityStatus" label="Data quality status">
          <Select id="dataQualityStatus" name="dataQualityStatus" defaultValue={defaultValues?.dataQualityStatus ?? "draft"}>
            {DATA_QUALITY_STATUSES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="flex flex-wrap gap-6">
          <Checkbox id="isActive" name="isActive" defaultChecked={defaultValues?.isActive ?? true} label="Active" />
          <Checkbox
            id="isVisible"
            name="isVisible"
            defaultChecked={defaultValues?.isVisible ?? false}
            label="Visible (reserved for future public display)"
          />
        </div>

        <FormField id="internalNotes" label="Internal notes" hint="Never shown to students.">
          <Textarea id="internalNotes" name="internalNotes" defaultValue={defaultValues?.internalNotes ?? ""} rows={3} />
        </FormField>
      </Card>

      <Card className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-primary">Global data platform details</h2>
          <p className="mt-1 text-sm text-muted">
            Milestone 9 structured fields — power the public university/course search and data-quality reporting.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="campusId" label="Campus" hint={campusOptions.length === 0 ? "No campuses recorded for this university yet." : undefined}>
            <Select id="campusId" name="campusId" defaultValue={defaultValues?.campusId ?? ""}>
              <option value="">— Not set —</option>
              {campusOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="programCode" label="Program code">
            <Input id="programCode" name="programCode" defaultValue={defaultValues?.programCode ?? ""} />
          </FormField>
          <FormField id="subjectArea" label="Subject area">
            <Input id="subjectArea" name="subjectArea" defaultValue={defaultValues?.subjectArea ?? ""} />
          </FormField>
          <FormField id="discipline" label="Discipline">
            <Input id="discipline" name="discipline" defaultValue={defaultValues?.discipline ?? ""} />
          </FormField>
          <FormField id="qualificationTitle" label="Qualification title">
            <Input id="qualificationTitle" name="qualificationTitle" defaultValue={defaultValues?.qualificationTitle ?? ""} />
          </FormField>
          <FormField id="award" label="Award">
            <Input id="award" name="award" defaultValue={defaultValues?.award ?? ""} />
          </FormField>
          <FormField id="durationValue" label="Duration value">
            <Input id="durationValue" name="durationValue" type="number" min={0} step="any" defaultValue={defaultValues?.durationValue ?? ""} />
          </FormField>
          <FormField id="durationUnit" label="Duration unit">
            <Select id="durationUnit" name="durationUnit" defaultValue={defaultValues?.durationUnit ?? ""}>
              <option value="">— Not set —</option>
              {COURSE_DURATION_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="studyPace" label="Study pace">
            <Select id="studyPace" name="studyPace" defaultValue={defaultValues?.studyPace ?? ""}>
              <option value="">— Not set —</option>
              {COURSE_STUDY_PACES.map((p) => (
                <option key={p} value={p}>
                  {p.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="teachingLanguage" label="Teaching language">
            <Input id="teachingLanguage" name="teachingLanguage" defaultValue={defaultValues?.teachingLanguage ?? ""} />
          </FormField>
          <FormField id="tuitionDomesticOrInternational" label="Tuition category">
            <Select
              id="tuitionDomesticOrInternational"
              name="tuitionDomesticOrInternational"
              defaultValue={defaultValues?.tuitionDomesticOrInternational ?? ""}
            >
              <option value="">— Not set —</option>
              {COURSE_TUITION_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="courseUrl" label="Course URL" hint="Must start with http:// or https://">
            <Input id="courseUrl" name="courseUrl" type="url" defaultValue={defaultValues?.courseUrl ?? ""} placeholder="https://" />
          </FormField>
        </div>

        <FormField id="additionalFeesSummary" label="Additional fees summary">
          <Textarea id="additionalFeesSummary" name="additionalFeesSummary" defaultValue={defaultValues?.additionalFeesSummary ?? ""} rows={3} />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="applicationFeeAmount" label="Application fee amount">
            <Input
              id="applicationFeeAmount"
              name="applicationFeeAmount"
              type="number"
              min={0}
              step="0.01"
              defaultValue={
                defaultValues?.applicationFeeMinorUnits != null ? (defaultValues.applicationFeeMinorUnits / 100).toString() : ""
              }
            />
          </FormField>
          <FormField id="applicationFeeCurrency" label="Application fee currency" hint="3-letter ISO 4217 code, e.g. EUR">
            <Input id="applicationFeeCurrency" name="applicationFeeCurrency" defaultValue={defaultValues?.applicationFeeCurrency ?? ""} maxLength={3} />
          </FormField>
        </div>

        <FormField id="intakePeriods" label="Intake periods" hint="Comma-separated, e.g. Fall, Spring">
          <Input id="intakePeriods" name="intakePeriods" defaultValue={(defaultValues?.intakePeriods ?? []).join(", ")} />
        </FormField>

        <FormField id="minAcademicRequirement" label="Minimum academic requirement">
          <Textarea id="minAcademicRequirement" name="minAcademicRequirement" defaultValue={defaultValues?.minAcademicRequirement ?? ""} rows={2} />
        </FormField>

        <FormField id="workExperienceRequired" label="Work experience required">
          <Input id="workExperienceRequired" name="workExperienceRequired" defaultValue={defaultValues?.workExperienceRequired ?? ""} />
        </FormField>

        <FormField id="studyGapPolicy" label="Study gap policy">
          <Textarea id="studyGapPolicy" name="studyGapPolicy" defaultValue={defaultValues?.studyGapPolicy ?? ""} rows={2} />
        </FormField>

        <FormField id="additionalDocumentsRequired" label="Additional documents required" hint="Comma-separated">
          <Input
            id="additionalDocumentsRequired"
            name="additionalDocumentsRequired"
            defaultValue={(defaultValues?.additionalDocumentsRequired ?? []).join(", ")}
          />
        </FormField>

        <div className="flex flex-wrap gap-6">
          <Checkbox
            id="portfolioRequired"
            name="portfolioRequired"
            defaultChecked={defaultValues?.portfolioRequired ?? false}
            label="Portfolio required"
          />
          <Checkbox
            id="interviewRequired"
            name="interviewRequired"
            defaultChecked={defaultValues?.interviewRequired ?? false}
            label="Interview required"
          />
          <Checkbox
            id="scholarshipsAvailable"
            name="scholarshipsAvailable"
            defaultChecked={defaultValues?.scholarshipsAvailable ?? false}
            label="Scholarships available"
          />
        </div>
        <p className="text-xs text-muted">
          Leaving a checkbox unchecked records &ldquo;not specified&rdquo; rather than &ldquo;no&rdquo; — only check it when the source explicitly states the requirement.
        </p>

        <FormField id="careerOutcomes" label="Career outcomes">
          <Textarea id="careerOutcomes" name="careerOutcomes" defaultValue={defaultValues?.careerOutcomes ?? ""} rows={3} />
        </FormField>

        <FormField id="professionalAccreditation" label="Professional accreditation">
          <Input id="professionalAccreditation" name="professionalAccreditation" defaultValue={defaultValues?.professionalAccreditation ?? ""} />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="dataSource" label="Data source">
            <Input id="dataSource" name="dataSource" defaultValue={defaultValues?.dataSource ?? ""} />
          </FormField>
          <FormField id="sourceUrl" label="Source URL" hint="Must start with http:// or https://">
            <Input id="sourceUrl" name="sourceUrl" type="url" defaultValue={defaultValues?.sourceUrl ?? ""} placeholder="https://" />
          </FormField>
          <FormField id="lastVerifiedAt" label="Last verified at">
            <Input id="lastVerifiedAt" name="lastVerifiedAt" type="date" defaultValue={defaultValues?.lastVerifiedAt ?? ""} />
          </FormField>
          <FormField id="verificationStatus" label="Verification status">
            <Select id="verificationStatus" name="verificationStatus" defaultValue={defaultValues?.verificationStatus ?? "unverified"}>
              {EDUCATION_VERIFICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {EDUCATION_VERIFICATION_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </Card>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
