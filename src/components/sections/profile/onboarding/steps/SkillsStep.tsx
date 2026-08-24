"use client";

import { TECHNICAL_SKILL_OPTIONS, TRANSFERABLE_SKILL_OPTIONS } from "@/data/profile-options";
import { SelectableLevelList } from "../SelectableLevelList";

interface SkillsStepProps {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

const MINIMUM = 2;

export function SkillsStep({ value, onChange }: SkillsStepProps) {
  function toggle(key: string) {
    const next = { ...value };
    if (key in next) delete next[key];
    else next[key] = "beginner";
    onChange(next);
  }

  function setLevel(key: string, level: string) {
    onChange({ ...value, [key]: level });
  }

  const count = Object.keys(value).length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Select skills you already have and how confident you are with each. Choose at least {MINIMUM}. This isn&apos;t
        a formal certification — just your honest self-assessment.{" "}
        <span className={count >= MINIMUM ? "font-medium text-success" : "font-medium text-muted"}>
          {count} selected
        </span>
      </p>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Technical</h3>
        <SelectableLevelList options={TECHNICAL_SKILL_OPTIONS} value={value} onToggle={toggle} onSetLevel={setLevel} />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Transferable</h3>
        <SelectableLevelList options={TRANSFERABLE_SKILL_OPTIONS} value={value} onToggle={toggle} onSetLevel={setLevel} />
      </div>
    </div>
  );
}
