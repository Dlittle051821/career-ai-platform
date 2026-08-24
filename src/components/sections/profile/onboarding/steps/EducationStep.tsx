"use client";

import { Plus, Trash2 } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  EDUCATION_LEVELS_WITH_ACADEMIC_DETAIL,
  EDUCATION_LEVEL_OPTIONS,
  EDUCATION_STATUS_OPTIONS,
  SCORE_TYPE_OPTIONS,
} from "@/data/profile-options";
import type { EducationInput } from "@/lib/supabase/student-profile-actions";

export interface EducationDraft extends EducationInput {
  draftId: string;
}

interface EducationStepProps {
  records: EducationDraft[];
  onChange: (next: EducationDraft[]) => void;
  error?: string;
}

function blankRecord(draftId: string): EducationDraft {
  return {
    draftId,
    educationLevel: "",
    institutionName: null,
    boardOrUniversity: null,
    fieldOfStudy: null,
    specialization: null,
    startYear: null,
    endYear: null,
    status: "ongoing",
    scoreType: null,
    scoreValue: null,
    backlogs: null,
  };
}

export function EducationStep({ records, onChange, error }: EducationStepProps) {
  function updateRecord(draftId: string, patch: Partial<EducationDraft>) {
    onChange(records.map((r) => (r.draftId === draftId ? { ...r, ...patch } : r)));
  }

  function addRecord() {
    onChange([...records, blankRecord(`draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)]);
  }

  function removeRecord(draftId: string) {
    onChange(records.filter((r) => r.draftId !== draftId));
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p role="alert" className="rounded-[var(--radius-control)] border border-error/25 bg-error-light px-4 py-3 text-sm text-error">
          {error}
        </p>
      ) : null}

      {records.length === 0 ? (
        <p className="text-sm text-muted">Add at least one education record — school, diploma, or degree.</p>
      ) : null}

      {records.map((record, index) => {
        const showAcademicDetail = EDUCATION_LEVELS_WITH_ACADEMIC_DETAIL.has(record.educationLevel);
        return (
          <Card key={record.draftId} className="relative">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-primary">Education #{index + 1}</p>
              <button
                type="button"
                onClick={() => removeRecord(record.draftId)}
                aria-label="Remove this education record"
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-error-light hover:text-error"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FormField id={`edu-level-${record.draftId}`} label="Education level" required>
                <Select
                  id={`edu-level-${record.draftId}`}
                  value={record.educationLevel}
                  onChange={(e) => updateRecord(record.draftId, { educationLevel: e.target.value })}
                >
                  <option value="">Select one</option>
                  {EDUCATION_LEVEL_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField id={`edu-status-${record.draftId}`} label="Status" required>
                <Select
                  id={`edu-status-${record.draftId}`}
                  value={record.status}
                  onChange={(e) => updateRecord(record.draftId, { status: e.target.value })}
                >
                  {EDUCATION_STATUS_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField id={`edu-institution-${record.draftId}`} label="Institution name">
                <Input
                  id={`edu-institution-${record.draftId}`}
                  value={record.institutionName ?? ""}
                  onChange={(e) => updateRecord(record.draftId, { institutionName: e.target.value || null })}
                />
              </FormField>

              {showAcademicDetail ? (
                <FormField id={`edu-board-${record.draftId}`} label="Board / University">
                  <Input
                    id={`edu-board-${record.draftId}`}
                    value={record.boardOrUniversity ?? ""}
                    onChange={(e) => updateRecord(record.draftId, { boardOrUniversity: e.target.value || null })}
                  />
                </FormField>
              ) : null}

              {showAcademicDetail ? (
                <FormField id={`edu-field-${record.draftId}`} label="Field of study / degree">
                  <Input
                    id={`edu-field-${record.draftId}`}
                    value={record.fieldOfStudy ?? ""}
                    onChange={(e) => updateRecord(record.draftId, { fieldOfStudy: e.target.value || null })}
                  />
                </FormField>
              ) : null}

              {showAcademicDetail ? (
                <FormField id={`edu-specialization-${record.draftId}`} label="Specialization / branch">
                  <Input
                    id={`edu-specialization-${record.draftId}`}
                    value={record.specialization ?? ""}
                    onChange={(e) => updateRecord(record.draftId, { specialization: e.target.value || null })}
                  />
                </FormField>
              ) : null}

              <FormField id={`edu-start-${record.draftId}`} label="Start year">
                <Input
                  id={`edu-start-${record.draftId}`}
                  type="number"
                  inputMode="numeric"
                  value={record.startYear ?? ""}
                  onChange={(e) => updateRecord(record.draftId, { startYear: e.target.value ? Number(e.target.value) : null })}
                />
              </FormField>

              <FormField id={`edu-end-${record.draftId}`} label="End year (or expected)">
                <Input
                  id={`edu-end-${record.draftId}`}
                  type="number"
                  inputMode="numeric"
                  value={record.endYear ?? ""}
                  onChange={(e) => updateRecord(record.draftId, { endYear: e.target.value ? Number(e.target.value) : null })}
                />
              </FormField>

              {showAcademicDetail ? (
                <>
                  <FormField id={`edu-score-type-${record.draftId}`} label="Score type">
                    <Select
                      id={`edu-score-type-${record.draftId}`}
                      value={record.scoreType ?? ""}
                      onChange={(e) => updateRecord(record.draftId, { scoreType: e.target.value || null, scoreValue: null })}
                    >
                      <option value="">Not set</option>
                      {SCORE_TYPE_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField id={`edu-score-value-${record.draftId}`} label="Score value" hint={scoreHint(record.scoreType)}>
                    <Input
                      id={`edu-score-value-${record.draftId}`}
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      disabled={!record.scoreType}
                      value={record.scoreValue ?? ""}
                      onChange={(e) => updateRecord(record.draftId, { scoreValue: e.target.value ? Number(e.target.value) : null })}
                    />
                  </FormField>

                  <FormField id={`edu-backlogs-${record.draftId}`} label="Backlogs" hint="Leave blank if none">
                    <Input
                      id={`edu-backlogs-${record.draftId}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={record.backlogs ?? ""}
                      onChange={(e) => updateRecord(record.draftId, { backlogs: e.target.value ? Number(e.target.value) : null })}
                    />
                  </FormField>
                </>
              ) : null}
            </div>
          </Card>
        );
      })}

      <Button type="button" variant="outline" icon={<Plus aria-hidden="true" className="h-4 w-4" />} onClick={addRecord}>
        Add another education record
      </Button>
    </div>
  );
}

function scoreHint(scoreType: string | null): string | undefined {
  if (scoreType === "percentage") return "0–100";
  if (scoreType === "cgpa_10") return "0–10";
  if (scoreType === "cgpa_4") return "0–4";
  return undefined;
}
