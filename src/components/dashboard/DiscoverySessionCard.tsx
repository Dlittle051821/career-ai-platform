import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarHeart } from "lucide-react";
import type { DiscoverySession } from "@/types/discovery-session";
import { DISCOVERY_SESSION_STATUS_LABELS } from "@/types/discovery-session";
import { formatDiscoverySessionDateTime } from "@/lib/discovery-sessions/format";

/**
 * UX10-D01 — "Discovery Session". `session` is the real
 * `getMyActiveDiscoverySession()` result — never a hardcoded counsellor
 * name. `mentor.png` is a provided illustrative asset used as a generic
 * "counsellor" visual, since `DiscoverySession` has no counsellor photo
 * field to show instead.
 *
 * NW05.5 — `activeSessionLabel` (default "Career Guidance Session",
 * unchanged for every existing caller) lets a caller elsewhere in the
 * product — e.g. the Abroad Workspace, which shares this same single
 * Discovery Session booking flow rather than running a second one —
 * describe an active session without the Career-specific label, since
 * there is no Abroad-specific session type to report.
 */
export function DiscoverySessionCard({
  session,
  activeSessionLabel = "Career Guidance Session",
}: {
  session: DiscoverySession | null;
  activeSessionLabel?: string;
}) {
  return (
    <section aria-labelledby="discovery-heading" className="flex h-full flex-col rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
          <CalendarHeart aria-hidden="true" className="h-4 w-4" />
        </span>
        <div>
          <h2 id="discovery-heading" className="font-sans text-base font-semibold text-text">
            Discovery Session
          </h2>
          {session ? <p className="text-xs text-muted">{DISCOVERY_SESSION_STATUS_LABELS[session.status]}</p> : null}
        </div>
      </div>

      {session ? (
        <div className="mt-4 flex flex-1 items-center gap-3">
          <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-intelligence-light">
            <Image src="/dashboard/mentor.png" alt="" aria-hidden="true" fill className="object-cover object-top" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text">{activeSessionLabel}</p>
            {session.scheduledAt ? <p className="text-xs text-muted">{formatDiscoverySessionDateTime(session.scheduledAt)}</p> : null}
            {session.assignedCounsellorName ? <p className="truncate text-xs text-muted">With {session.assignedCounsellorName}</p> : null}
          </div>
        </div>
      ) : (
        <p className="mt-4 flex-1 text-sm text-muted">A free, no-obligation first conversation with a counsellor.</p>
      )}

      <Link href="/discovery-session/book" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-light">
        {session ? "View Session Details" : "Book Session"}
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
