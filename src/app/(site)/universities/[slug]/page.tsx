import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, SearchX, MapPin } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LinkButton } from "@/components/ui/Button";
import { GuidanceNotice } from "@/components/ui/GuidanceNotice";
import { FreshnessBadge, humanizeEnumValue } from "@/components/sections/education/UniversityCard";
import { SaveUniversityButton } from "@/components/sections/education/SaveUniversityButton";
import {
  getPublicUniversityBySlug,
  listPublicCampusesForUniversity,
  listPublicScholarshipsForUniversity,
} from "@/lib/supabase/education/universities";
import { listSavedEntityIds } from "@/lib/supabase/education/saved-items";
import { getCurrentProfile } from "@/lib/supabase/profile";
import { formatMoney } from "@/lib/admin/money";
import { ACCREDITATION_STATUS_LABELS, type AccreditationStatus } from "@/types/admin";
import { EDUCATION_VERIFICATION_STATUS_LABELS, type EducationVerificationStatus } from "@/types/education";
import { trackEvent } from "@/lib/supabase/analytics/track";

interface UniversityDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: UniversityDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const university = await getPublicUniversityBySlug(slug);
  if (!university) return { title: "University not found" };
  return { title: university.name, description: university.summary ?? undefined };
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}

function accreditationLabel(status: string): string {
  return ACCREDITATION_STATUS_LABELS[status as AccreditationStatus] ?? humanizeEnumValue(status);
}

function verificationLabel(status: string): string {
  return EDUCATION_VERIFICATION_STATUS_LABELS[status as EducationVerificationStatus] ?? humanizeEnumValue(status);
}

/**
 * Public university detail route (Milestone 9), e.g.
 * `/universities/iit-delhi`. Public like `/universities` itself — the
 * middleware doesn't gate this path (see PROTECTED_PATHS in
 * src/lib/supabase/middleware.ts). Only the Save button's write path needs
 * a logged-in user; the page itself renders for everyone.
 *
 * Never fills in a plausible-looking placeholder for a missing field — every
 * optional value either renders "Not available" or is omitted outright,
 * matching what getPublicUniversityBySlug actually returns.
 */
export default async function UniversityDetailPage({ params }: UniversityDetailPageProps) {
  const { slug } = await params;
  const university = await getPublicUniversityBySlug(slug);

  if (!university) {
    return (
      <Section tone="muted" className="pt-10 sm:pt-14">
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <SearchX aria-hidden="true" className="h-10 w-10 text-muted" />
          <h1 className="text-lg font-semibold text-primary">We couldn&apos;t find that university</h1>
          <p className="max-w-sm text-sm text-muted">
            It may have been renamed, isn&apos;t published yet, or the link may be out of date.
          </p>
          <LinkButton href="/universities" size="sm" className="mt-2">
            Browse the University Explorer
          </LinkButton>
        </Card>
      </Section>
    );
  }

  const profile = await getCurrentProfile();
  const isLoggedIn = profile !== null;

  void trackEvent({
    eventName: "college_viewed",
    source: "university_detail_page",
    path: `/universities/${university.slug}`,
    feature: "university_explorer",
    entityType: "university",
    entityId: university.id,
    properties: { slug: university.slug },
  });

  const [campuses, scholarships, savedIds] = await Promise.all([
    listPublicCampusesForUniversity(university.id),
    listPublicScholarshipsForUniversity(university.id),
    isLoggedIn ? listSavedEntityIds("university") : Promise.resolve<string[]>([]),
  ]);

  const location = [university.stateRegion, university.countryName].filter(Boolean).join(", ");
  const lastVerifiedLabel = formatDate(university.lastVerifiedAt);

  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "University Explorer", href: "/universities" }, { label: university.name }]} />

      <div className="mt-6 mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {university.institutionType ? <Badge tone="info">{humanizeEnumValue(university.institutionType)}</Badge> : null}
            {university.ownershipType ? <Badge tone="neutral">{humanizeEnumValue(university.ownershipType)}</Badge> : null}
            <FreshnessBadge band={university.freshnessBand} />
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-primary balance sm:text-4xl">{university.name}</h1>
          {(location || university.city) ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
              <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
              {[university.city, university.stateRegion, university.countryName].filter(Boolean).join(", ")}
            </p>
          ) : null}
          {university.summary ? <p className="mt-3 max-w-2xl text-base text-muted">{university.summary}</p> : null}
        </div>
        <SaveUniversityButton universityId={university.id} slug={university.slug} isLoggedIn={isLoggedIn} initialSaved={savedIds.includes(university.id)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="text-lg font-semibold text-primary">Overview</h2>
            <dl className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Founded</dt>
                <dd className="mt-1 text-sm text-text-soft">{university.foundingYear ?? "Not available"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Accreditation</dt>
                <dd className="mt-1 text-sm text-text-soft">
                  {accreditationLabel(university.accreditationStatus)}
                  {university.accreditationOrganization ? ` — ${university.accreditationOrganization}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Study levels</dt>
                <dd className="mt-1 text-sm text-text-soft">
                  {university.studyLevels.length > 0 ? university.studyLevels.map(humanizeEnumValue).join(", ") : "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Study modes</dt>
                <dd className="mt-1 text-sm text-text-soft">
                  {university.studyModes.length > 0 ? university.studyModes.map(humanizeEnumValue).join(", ") : "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Application fee</dt>
                <dd className="mt-1 text-sm text-text-soft">
                  {university.applicationFeeMinorUnits != null && university.applicationFeeCurrency
                    ? formatMoney(university.applicationFeeMinorUnits, university.applicationFeeCurrency)
                    : "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Scholarships available</dt>
                <dd className="mt-1 text-sm text-text-soft">
                  {university.scholarshipsAvailable == null ? "Not available" : university.scholarshipsAvailable ? "Yes" : "No"}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-4">
              {university.websiteUrl ? (
                <a href={university.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-dark hover:text-primary">
                  Official website
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
              ) : null}
              {university.admissionsUrl ? (
                <a href={university.admissionsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-dark hover:text-primary">
                  Admissions
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
              ) : null}
              {university.internationalAdmissionsUrl ? (
                <a href={university.internationalAdmissionsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-dark hover:text-primary">
                  International admissions
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          </Card>

          {university.ranking.length > 0 ? (
            <Card>
              <h2 className="text-lg font-semibold text-primary">Rankings</h2>
              <div className="mt-3 space-y-2">
                {university.ranking.map((entry, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm">
                    <span className="font-medium text-text">{entry.provider}</span>
                    {entry.category ? <span className="text-muted">· {entry.category}</span> : null}
                    <span className="text-muted">{entry.year}</span>
                    <Badge tone="accent" className="ml-auto text-[11px]">
                      Rank {entry.rank}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {university.campusInfo ? (
            <Card>
              <h2 className="text-lg font-semibold text-primary">Campus</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{university.campusInfo}</p>
            </Card>
          ) : null}

          {campuses.length > 0 ? (
            <Card>
              <h2 className="text-lg font-semibold text-primary">Campuses</h2>
              <div className="mt-3 space-y-2">
                {campuses.map((campus) => (
                  <div key={campus.id} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm">
                    <span className="font-medium text-text">{campus.name}</span>
                    <span className="text-muted">
                      {[campus.city, campus.stateRegion, campus.countryName].filter(Boolean).join(", ") || "Location not available"}
                    </span>
                    {campus.isMain ? (
                      <Badge tone="info" className="ml-auto text-[11px]">
                        Main campus
                      </Badge>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {university.internationalStudentSupport ? (
            <Card>
              <h2 className="text-lg font-semibold text-primary">International student support</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{university.internationalStudentSupport}</p>
            </Card>
          ) : null}

          {scholarships.length > 0 ? (
            <Card>
              <h2 className="text-lg font-semibold text-primary">Scholarships at this university</h2>
              <div className="mt-3 space-y-3">
                {scholarships.map((scholarship) => (
                  <div key={scholarship.id} className="rounded-[var(--radius-control)] border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-text">{scholarship.name}</p>
                      {scholarship.awardAmountMinorUnits != null && scholarship.currencyCode ? (
                        <Badge tone="success" className="text-[11px]">
                          {formatMoney(scholarship.awardAmountMinorUnits, scholarship.currencyCode)}
                        </Badge>
                      ) : null}
                    </div>
                    {scholarship.eligibility ? <p className="mt-1.5 text-sm text-muted">{scholarship.eligibility}</p> : null}
                    {scholarship.awardDescription ? <p className="mt-1 text-sm text-muted">{scholarship.awardDescription}</p> : null}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                      {scholarship.deadline ? <span>Deadline: {formatDate(scholarship.deadline) ?? scholarship.deadline}</span> : null}
                      {scholarship.internationalEligible != null ? (
                        <span>{scholarship.internationalEligible ? "Open to international students" : "Domestic students only"}</span>
                      ) : null}
                      {scholarship.scholarshipUrl ? (
                        <a href={scholarship.scholarshipUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-secondary-dark hover:text-primary">
                          Details
                          <ExternalLink aria-hidden="true" className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-primary">Courses</h2>
            <p className="mt-2 text-sm text-muted">Browse courses offered at {university.name}.</p>
            <LinkButton href={`/courses?universityId=${university.id}`} size="sm" variant="outline" className="mt-3">
              View courses
            </LinkButton>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-primary">Data source</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Verification status</dt>
                <dd className="mt-1 text-text-soft">{verificationLabel(university.verificationStatus)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Last verified</dt>
                <dd className="mt-1 text-text-soft">{lastVerifiedLabel ?? "Not available"}</dd>
              </div>
              {university.sourceUrl ? (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">Source</dt>
                  <dd className="mt-1">
                    <a href={university.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-secondary-dark hover:text-primary">
                      View source
                      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-4 text-xs text-muted">
              Always confirm current fees, deadlines, and admission requirements directly with the institution
              before you act on them.
            </p>
          </Card>
        </div>
      </div>

      <GuidanceNotice className="mt-8">
        This page is a representative starter dataset entry, not an exhaustive or guaranteed-current record — see
        the verification status and last-verified date above, and confirm anything time-sensitive directly with the
        institution. Save this university to come back to it later at{" "}
        <Link href="/saved" className="font-medium underline underline-offset-2">/saved</Link>.
      </GuidanceNotice>

      <div className="mt-6">
        <Link href="/universities" className="text-sm font-semibold text-secondary-dark hover:text-primary">
          ← Back to University Explorer
        </Link>
      </div>
    </Section>
  );
}
