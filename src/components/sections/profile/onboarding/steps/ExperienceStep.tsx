"use client";

import { Plus, Trash2 } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Select } from "@/components/forms/Select";
import { Textarea } from "@/components/forms/Textarea";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EXPERIENCE_TYPE_OPTIONS } from "@/data/profile-options";
import type { ExperienceInput } from "@/lib/supabase/student-profile-actions";

export interface ExperienceDraft extends ExperienceInput {
  draftId: string;
}

interface ExperienceStepProps {
  records: ExperienceDraft[];
  onChange: (next: ExperienceDraft[]) => void;
}

function blankRecord(draftId: string): ExperienceDraft {
  return { draftId, type: "project", title: "", organization: null, description: null, year: null };
}

export function ExperienceStep({ records, onChange }: ExperienceStepProps) {
  function updateRecord(draftId: string, patch: Partial<ExperienceDraft>) {
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
      <div className="flex items-start gap-2">
        <Badge tone="neutral">Optional</Badge>
        <p className="text-sm text-muted">
          Internships, projects, competitions, certifications, work experience, or extracurriculars — add anything
          worth mentioning, or skip this section entirely.
        </p>
      </div>

      {records.map((record, index) => (
        <Card key={record.draftId} className="relative">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-primary">Entry #{index + 1}</p>
            <button
              type="button"
              onClick={() => removeRecord(record.draftId)}
              aria-label="Remove this entry"
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-error-light hover:text-error"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField id={`exp-type-${record.draftId}`} label="Type" required>
              <Select id={`exp-type-${record.draftId}`} value={record.type} onChange={(e) => updateRecord(record.draftId, { type: e.target.value })}>
                {EXPERIENCE_TYPE_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField id={`exp-title-${record.draftId}`} label="Title" required>
              <Input id={`exp-title-${record.draftId}`} value={record.title} onChange={(e) => updateRecord(record.draftId, { title: e.target.value })} />
            </FormField>

            <FormField id={`exp-org-${record.draftId}`} label="Organization" hint="Optional">
              <Input
                id={`exp-org-${record.draftId}`}
                value={record.organization ?? ""}
                onChange={(e) => updateRecord(record.draftId, { organization: e.target.value || null })}
              />
            </FormField>

            <FormField id={`exp-year-${record.draftId}`} label="Year" hint="Optional">
              <Input
                id={`exp-year-${record.draftId}`}
                type="number"
                inputMode="numeric"
                value={record.year ?? ""}
                onChange={(e) => updateRecord(record.draftId, { year: e.target.value ? Number(e.target.value) : null })}
              />
            </FormField>

            <div className="sm:col-span-2">
              <FormField id={`exp-desc-${record.draftId}`} label="Description" hint="Optional">
                <Textarea
                  id={`exp-desc-${record.draftId}`}
                  rows={2}
                  value={record.description ?? ""}
                  onChange={(e) => updateRecord(record.draftId, { description: e.target.value || null })}
                />
              </FormField>
            </div>
          </div>
        </Card>
      ))}

      <Button type="button" variant="outline" icon={<Plus aria-hidden="true" className="h-4 w-4" />} onClick={addRecord}>
        Add an entry
      </Button>
    </div>
  );
}
