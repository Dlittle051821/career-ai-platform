import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, FileCheck2, MapPin, Star } from "lucide-react";
import type { PublicUniversitySummary } from "@/lib/supabase/education/universities";
import { categoryLabel, ownershipLabel, studyAreaLabel } from "@/lib/education/university-discovery/directory";
import { isVerifiedEducationRecord } from "@/lib/education/verification-display";
import { SaveButton, SaveError, SaveHeart, SaveUniversityProvider } from "./SaveUniversity";

const MAX_AREAS = 3;

function formatChecked(date: string | null): string | null {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed);
}

interface UniversityDirectoryCardProps {
  university: PublicUniversitySummary;
  saved: boolean;
  index?: number;
  /** In the saved list the button reads "Remove" instead of "Saved". */
  removeLabel?: boolean;
  /** Staff accounts browse the directory but have no student shortlist. */
  canSave?: boolean;
}

/**
 * University Discovery V3 directory card. Every line is a stored fact: the
 * photograph carries its credit, the highlight is shown only when it has a
 * source, and a record that Nextwise has not verified says so instead of
 * borrowing a "verified" look.
 */
export function UniversityDirectoryCard({ university, saved, index = 0, removeLabel = false, canSave = true }: UniversityDirectoryCardProps) {
  const category = categoryLabel(university.institutionCategory, "short");
  const ownership = ownershipLabel(university.ownershipType);
  const areas = university.studyAreas.map(studyAreaLabel).filter((label): label is string => Boolean(label));
  const location = [university.city, university.stateRegion, university.countryName].filter(Boolean).join(", ");
  const verified = isVerifiedEducationRecord(university.verificationStatus);
  const checked = formatChecked(university.lastVerifiedAt);
  const photo = university.heroPhoto;
  const href = `/universities/${university.slug}`;

  const body = (
    <article className="ud-uc" style={{ "--i": index % 12 } as React.CSSProperties}>
      <div className="ud-uc-im">
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- licence-cleared campus photograph served from /public with its credit */}
            <img src={photo.url} alt={photo.alt} loading={index < 3 ? "eager" : "lazy"} decoding="async" width={800} height={392} />
            <a className="ud-credit" href={photo.creditSourceUrl} target="_blank" rel="noopener noreferrer" title={`Photo: ${photo.creditAuthor}, ${photo.licenceName}`}>
              Photo: {photo.creditAuthor} · {photo.licenceName}
            </a>
          </>
        ) : (
          <div className="ud-uc-ph" role="img" aria-label="No photograph recorded for this university yet">
            <Building2 aria-hidden="true" />
            Photo not yet available
          </div>
        )}
        {category ? <span className="ud-uc-ty">{category}</span> : null}
      </div>
      {canSave ? <SaveHeart /> : null}
      {canSave ? <SaveError /> : null}
      <div className="ud-uc-bd">
        <h3>
          <Link href={href}>{university.name}</Link>
        </h3>
        <p className="ud-uc-lc">
          <MapPin aria-hidden="true" />
          <span>{location || "Location not recorded"}</span>
          {ownership ? <b>{ownership}</b> : null}
        </p>
        {areas.length > 0 ? (
          <>
            <span className="ud-uc-sm">Study areas</span>
            <div className="ud-tgs">
              {areas.slice(0, MAX_AREAS).map((label) => (
                <span key={label} className="ud-tg">{label}</span>
              ))}
              {areas.length > MAX_AREAS ? <span className="ud-tg" data-more>+{areas.length - MAX_AREAS} more</span> : null}
            </div>
          </>
        ) : null}
        {university.leadHighlight ? (
          <p className="ud-uc-hl">
            <Star aria-hidden="true" />
            <span>{university.leadHighlight.text}</span>
          </p>
        ) : null}
        {verified ? (
          <p className="ud-src" data-verified>
            <BadgeCheck aria-hidden="true" />
            Verified by Nextwise{checked ? ` · ${checked}` : ""}
          </p>
        ) : (
          <p className="ud-src">
            <FileCheck2 aria-hidden="true" />
            Official source recorded{checked ? ` · checked ${checked}` : ""} · not yet verified
          </p>
        )}
        <div className="ud-uc-ft">
          <Link href={href} className="ud-btn" data-variant="navy" aria-label={`View ${university.name}`}>
            View University
            <ArrowRight aria-hidden="true" />
          </Link>
          {canSave ? <SaveButton removeLabel={removeLabel} /> : null}
        </div>
      </div>
    </article>
  );

  if (!canSave) return body;
  return (
    <SaveUniversityProvider universityId={university.id} slug={university.slug} name={university.name} initialSaved={saved}>
      {body}
    </SaveUniversityProvider>
  );
}
