import { CalendarClock, Laptop, ShieldCheck, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";

/**
 * UX10-DS01 — the human/counsellor trust card shown beside the real
 * booking form, matching the reference image's "counsellor trust card"
 * section. Deliberately does NOT invent a named counsellor, a credential
 * claim ("15 years experience"), or a fixed session duration — none of
 * those are defined anywhere in this codebase's real business content
 * (confirmed by searching for session-duration/counsellor-bio copy during
 * this milestone's audit). "Session duration will be confirmed with your
 * booking" is used instead of a fabricated "30-45 minutes", per the
 * brief's own explicit instruction for exactly this situation.
 */
const DETAILS = [
  { icon: CalendarClock, label: "Session duration will be confirmed with your booking" },
  { icon: Laptop, label: "Online session" },
  { icon: Users, label: "Parents can join" },
  { icon: ShieldCheck, label: "Conducted by the Nextwise guidance team" },
];

export function SessionTrustCard() {
  return (
    <Card>
      <p className="text-base font-semibold text-primary">A friendly conversation.</p>
      <p className="text-base font-semibold text-primary">Real guidance. No pressure.</p>
      <ul className="mt-4 space-y-3">
        {DETAILS.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-start gap-2.5 text-sm leading-relaxed text-text-soft">
            <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
