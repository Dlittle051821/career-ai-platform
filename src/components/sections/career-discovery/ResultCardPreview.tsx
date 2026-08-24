import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SAMPLE_RESULT } from "@/data/career-discovery";

export function ResultCardPreview() {
  return (
    <Card className="border-2 border-secondary/30 bg-secondary-light/40">
      <div className="flex items-center justify-between gap-3">
        <Badge tone="accent">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
          {SAMPLE_RESULT.label}
        </Badge>
      </div>
      <h3 className="mt-4 text-xl font-semibold text-primary">{SAMPLE_RESULT.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-soft">{SAMPLE_RESULT.description}</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {SAMPLE_RESULT.matchFactors.map((factor) => (
          <li key={factor} className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-secondary-dark">
            {factor}
          </li>
        ))}
      </ul>
    </Card>
  );
}
