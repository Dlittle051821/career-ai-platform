"use client";

import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/forms/Input";
import { Textarea } from "@/components/forms/Textarea";
import { CAREER_GOAL_CLARITY_OPTIONS } from "@/data/profile-options";
import { cn } from "@/lib/utils";
import type { CareerGoalsInput } from "@/lib/supabase/student-profile-actions";

interface CareerGoalsStepProps {
  value: CareerGoalsInput;
  onChange: (next: CareerGoalsInput) => void;
}

export function CareerGoalsStep({ value, onChange }: CareerGoalsStepProps) {
  function set<K extends keyof CareerGoalsInput>(key: K, next: CareerGoalsInput[K]) {
    onChange({ ...value, [key]: next });
  }

  function setIdea(index: number, text: string) {
    const ideas = [value.careerIdeas[0] ?? "", value.careerIdeas[1] ?? "", value.careerIdeas[2] ?? ""];
    ideas[index] = text;
    set("careerIdeas", ideas);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium text-text">Do you already know your dream career?</p>
        <div role="radiogroup" aria-label="Career clarity" className="flex flex-col gap-2 sm:flex-row">
          {CAREER_GOAL_CLARITY_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={value.clarity === option.key}
              onClick={() => set("clarity", option.key)}
              className={cn(
                "flex-1 rounded-[var(--radius-control)] border px-4 py-3 text-left text-sm font-medium transition-colors",
                value.clarity === option.key
                  ? "border-secondary bg-secondary-light text-secondary-dark"
                  : "border-border-strong bg-surface text-text-soft hover:border-secondary"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {value.clarity === "clear" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="goal-job-title" label="Dream job title" required>
            <Input
              id="goal-job-title"
              value={value.dreamJobTitle ?? ""}
              onChange={(e) => set("dreamJobTitle", e.target.value || null)}
            />
          </FormField>
          <FormField id="goal-industry" label="Dream industry" hint="Optional">
            <Input
              id="goal-industry"
              value={value.dreamIndustry ?? ""}
              onChange={(e) => set("dreamIndustry", e.target.value || null)}
            />
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="goal-reason" label="Why this career?" hint="Optional">
              <Textarea
                id="goal-reason"
                rows={3}
                value={value.dreamReason ?? ""}
                onChange={(e) => set("dreamReason", e.target.value || null)}
              />
            </FormField>
          </div>
        </div>
      ) : null}

      {value.clarity === "some_ideas" ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-text">List up to 3 career ideas you&apos;re considering</p>
          {[0, 1, 2].map((index) => (
            <Input
              key={index}
              aria-label={`Career idea ${index + 1}`}
              placeholder={`Idea ${index + 1}`}
              value={value.careerIdeas[index] ?? ""}
              onChange={(e) => setIdea(index, e.target.value)}
            />
          ))}
        </div>
      ) : null}

      <FormField
        id="goal-life"
        label="What kind of life do you want your career to support?"
        hint="Optional — this won't be used to generate recommendations on its own"
      >
        <Textarea
          id="goal-life"
          rows={3}
          value={value.lifeGoalsText ?? ""}
          onChange={(e) => set("lifeGoalsText", e.target.value || null)}
        />
      </FormField>
    </div>
  );
}
