import Link from "next/link";
import { ArrowRight, Building2, Heart, Lock } from "lucide-react";
import type { PublicUniversitySummary } from "@/lib/supabase/education/universities";
import type { UniversityAccessState } from "@/lib/education/university-discovery/access";
import { canUseUniversityDirectory } from "@/lib/education/university-discovery/access";
import type { VerifiedOfferData } from "@/lib/education/university-discovery/offer";
import { categoryLabel } from "@/lib/education/university-discovery/directory";
import { VerifiedAccessDialog } from "./VerifiedAccessDialog";

interface SavedUniversitiesPanelProps {
  accessState: UniversityAccessState;
  /** How many universities the student has saved (their own rows; always known, even without directory access). */
  savedCount: number;
  /** Resolved records. Empty whenever the student has no directory access: nothing is fetched for them. */
  universities: PublicUniversitySummary[];
  offer: VerifiedOfferData;
  returnTo: string;
}

const PREVIEW = 3;

/**
 * Saved universities in the student's Studio (University Discovery V3).
 * Three honest states: an empty shortlist, a shortlist the student can open,
 * and a shortlist that is kept but locked because Verified access is not
 * active. In the locked state no university record is fetched or shown,
 * only the count of the student's own saved rows.
 */
export function SavedUniversitiesPanel({ accessState, savedCount, universities, offer, returnTo }: SavedUniversitiesPanelProps) {
  const hasAccess = canUseUniversityDirectory(accessState);
  return (
    <section className="ud ud-panel" aria-labelledby="ud-saved-unis" style={{ background: "#fff" }}>
      <div className="ud-panel-top">
        <h2 id="ud-saved-unis">
          <Heart aria-hidden="true" style={{ width: 18, height: 18, color: "var(--ud-pink)", fill: "var(--ud-pink)" }} />
          Saved universities{savedCount > 0 ? ` (${savedCount})` : ""}
        </h2>
        {hasAccess && savedCount > 0 ? (
          <Link href="/saved">
            Open shortlist
            <ArrowRight aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      {!hasAccess && savedCount > 0 ? (
        <div className="ud-lockrow">
          <i aria-hidden="true"><Lock /></i>
          <div>
            <b>Your shortlist of {savedCount} universit{savedCount === 1 ? "y is" : "ies are"} safe.</b>
            <span>Nextwise Verified is not active on your account right now, so the profiles are locked. Nothing has been deleted.</span>
          </div>
          <VerifiedAccessDialog accessState={accessState} offer={offer} returnTo={returnTo} triggerLabel="See how to unlock" triggerVariant="coral" />
        </div>
      ) : savedCount === 0 ? (
        <div className="ud-state" style={{ padding: "2rem 1rem", border: 0 }}>
          <i aria-hidden="true"><Building2 /></i>
          <h2 style={{ fontSize: "1.06rem" }}>No universities saved yet</h2>
          <p>
            {hasAccess
              ? "Tap the heart on any university to add it to your shortlist. It will appear here."
              : "Saving universities is part of Nextwise Verified. You can explore every destination and its official portals for free."}
          </p>
          <Link href="/universities" className="ud-btn" data-variant="navy">
            {hasAccess ? "Explore universities" : "Explore destinations"}
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <>
          <ul className="ud-mini-grid">
            {universities.slice(0, PREVIEW).map((university) => (
              <li key={university.id}>
                <Link href={`/universities/${university.slug}`} className="ud-mini">
                  <span className="ud-mini-im">
                    {university.heroPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element -- licence-cleared campus photograph served from /public
                      <img src={university.heroPhoto.url} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <Building2 aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <b>{university.name}</b>
                    <span>{[university.city, categoryLabel(university.institutionCategory, "short")].filter(Boolean).join(" · ") || "University"}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {savedCount > PREVIEW ? (
            <p className="ud-src" style={{ marginTop: 14 }}>
              and {savedCount - Math.min(PREVIEW, universities.length)} more in your shortlist
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
