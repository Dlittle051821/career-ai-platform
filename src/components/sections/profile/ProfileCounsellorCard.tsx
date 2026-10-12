import Link from "next/link";
import { Info, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { PROFILE_SECTION_KEYS, PROFILE_SECTION_LABELS, type ProfileSectionKey, type SectionProvenance } from "@/types/profile-provenance";

/**
 * UX10-P01 — right column, card 3. Reuses the exact same real provenance
 * data `src/components/sections/profile/ProvenanceSummaryCard.tsx` (the
 * old `/profile` page's component) already reads from
 * `getMySectionProvenanceMap()` — never a new/invented verification
 * concept. Unlike that component (which renders nothing at all when no
 * section has been touched), the brief asks for an always-visible card
 * with a truthful empty state here, so this is a new component rather
 * than a straight reuse — `ProvenanceSummaryCard.tsx` itself is left on
 * disk, unreferenced by this new page (same "superseded component stays
 * on disk" convention as every earlier milestone), since it may still be
 * useful elsewhere.
 */
export function ProfileCounsellorCard({ provenanceMap }: { provenanceMap: Record<ProfileSectionKey, SectionProvenance> | null }) {
  const touched = provenanceMap
    ? PROFILE_SECTION_KEYS.map((key) => provenanceMap[key]).filter((p) => p.provenance !== "SELF_ENTERED")
    : [];

  return (
    <section aria-labelledby="counsellor-verified-heading" className="rounded-[1.5rem] border border-border bg-surface p-5 shadow-soft sm:p-6">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-light text-success">
          <ShieldCheck aria-hidden="true" className="h-4 w-4" />
        </span>
        <h2 id="counsellor-verified-heading" className="font-sans text-base font-semibold text-text">
          Counsellor Verified
        </h2>
      </div>

      {touched.length > 0 ? (
        <>
          <p className="mt-3 text-xs text-muted">
            {touched.length} of {PROFILE_SECTION_KEYS.length} sections have counsellor input, recorded during a Discovery Session or follow-up.
          </p>
          <ul className="mt-3 space-y-2">
            {touched.map((p) => (
              <li key={p.sectionKey} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 first:border-0 first:pt-0">
                <span className="text-sm text-text">{PROFILE_SECTION_LABELS[p.sectionKey]}</span>
                <StatusBadge status={p.provenance.toLowerCase()} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-sm text-text-soft">
          Complete your profile and attend a Discovery Session to unlock counsellor verification.
        </p>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-xl bg-surface-alt px-3.5 py-3 text-xs text-muted">
        <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          Fields reviewed by a Nextwise counsellor are marked here — this never changes your answers, it just tracks who vouches for them.{" "}
          <Link href="/discovery-session/book" className="font-medium text-primary underline underline-offset-2 hover:text-primary-light">
            Book a Discovery Session
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
