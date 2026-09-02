import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { PROFILE_SECTION_KEYS, PROFILE_SECTION_LABELS, type ProfileSectionKey, type SectionProvenance } from "@/types/profile-provenance";

/**
 * Milestone 11-C1 — student-facing, read-only summary of which profile
 * sections a Nextwise counsellor has entered or verified on the student's
 * behalf. Deliberately renders nothing at all when no section has ever
 * been touched by a counsellor (the common case for a purely self-serve
 * profile) — SELF_ENTERED is the default, not something worth surfacing.
 * A brand-new component, not a modification of the reused ReviewStep/
 * ProfileView (see ProfileView.tsx's own comment on why those are reused
 * as-is).
 */
export function ProvenanceSummaryCard({ provenanceMap }: { provenanceMap: Record<ProfileSectionKey, SectionProvenance> }) {
  const touchedSections = PROFILE_SECTION_KEYS.map((key) => provenanceMap[key]).filter((p) => p.provenance !== "SELF_ENTERED");
  if (touchedSections.length === 0) return null;

  return (
    <Card className="mb-6">
      <p className="text-sm font-semibold text-primary">Counsellor input on your profile</p>
      <p className="mt-1 text-xs text-muted">
        A Nextwise counsellor has recorded input on the sections below — either during a Discovery Session or a
        follow-up. This never changes your answers; it just tracks who vouches for them.
      </p>
      <ul className="mt-3 space-y-2">
        {touchedSections.map((p) => (
          <li key={p.sectionKey} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 first:border-0 first:pt-0">
            <span className="text-sm text-text">{PROFILE_SECTION_LABELS[p.sectionKey]}</span>
            <StatusBadge status={p.provenance.toLowerCase()} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
