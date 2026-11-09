import { ExternalLink, Info } from "lucide-react";
import { UNVERIFIED_RECORD_NOTE } from "@/lib/education/verification-display";

/** CC-22B — shown on a university or course page whose record is not verified, pointing students to the official source. */
export function UnverifiedRecordNotice({ officialUrl, officialLabel }: { officialUrl: string | null; officialLabel: string }) {
  return (
    <div role="note" className="mb-6 flex items-start gap-3 rounded-[var(--radius-card)] border border-warning/30 bg-warning-light px-4 py-3 text-sm text-text">
      <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div>
        <p>{UNVERIFIED_RECORD_NOTE}</p>
        {officialUrl ? (
          <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1.5 font-semibold text-secondary-dark underline underline-offset-2 hover:text-primary">
            {officialLabel}
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}
