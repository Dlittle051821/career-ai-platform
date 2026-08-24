import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SAMPLE_QUESTIONS } from "@/data/career-discovery";

/** Static, clearly-labelled preview of the assessment format — not a functioning test. */
export function AssessmentPreview() {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-primary">Sample questions</p>
        <Badge tone="neutral">Preview — not scored</Badge>
      </div>
      <ol className="mt-5 space-y-5">
        {SAMPLE_QUESTIONS.map((question, index) => (
          <li key={question.prompt}>
            <p className="text-sm font-medium text-text-soft">
              {index + 1}. {question.prompt}
            </p>
            {question.type === "scale" ? (
              <div className="mt-3 flex items-center gap-2" aria-hidden="true">
                {["Disagree", "", "", "", "Agree"].map((label, i) => (
                  <span key={i} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="h-4 w-4 rounded-full border-2 border-border-strong" />
                    <span className="text-[11px] text-muted">{label}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-hidden="true">
                {question.options?.map((option) => (
                  <span
                    key={option}
                    className="rounded-[var(--radius-control)] border border-border-strong px-3 py-2 text-xs text-text-soft"
                  >
                    {option}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
