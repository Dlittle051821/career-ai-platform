import type { Metadata } from "next";
import { Scale, TriangleAlert } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { GuidanceNotice } from "@/components/ui/GuidanceNotice";
import { ComparePicker } from "@/components/sections/compare/ComparePicker";
import { ComparisonTable } from "@/components/sections/compare/ComparisonTable";
import { getCareerOptionsForComparison, getCareerBySlug } from "@/lib/supabase/careers";
import { getStudentProfileSnapshot } from "@/lib/supabase/student-profile";
import { buildComparisonMatrix, careerDetailToMatchProfile, MAX_COMPARE_CAREERS, MIN_COMPARE_CAREERS } from "@/lib/careers/compare";
import { getRecommendations, hasMinimumProfileDataForRecommendations } from "@/lib/recommendations";
import type { RecommendationResult } from "@/lib/recommendations";

export const metadata: Metadata = {
  title: "Compare Careers",
  description: "Compare two or three careers side by side — subjects, skills, education routes, and characteristics.",
};

interface ComparePageProps {
  searchParams: Promise<{ a?: string; b?: string; c?: string }>;
}

/**
 * Milestone 6 — Career Comparison. Public, like `/careers` and
 * `/careers/[slug]` — no login required to compare careers factually. If
 * the viewer IS signed in with enough Student Digital Profile data, each
 * compared career additionally shows its own qualitative match band,
 * computed by re-running the (already fully tested) Milestone 5 engine
 * against just the 2-3 careers on screen — never a second scoring
 * implementation, and never another student's data (the snapshot fetch is
 * scoped to `auth.uid()` via RLS, same as `/recommendations`).
 */
export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams;
  const options = await getCareerOptionsForComparison();
  const selectedForPicker: (string | undefined)[] = [params.a, params.b, params.c];

  const rawSlugs = [params.a, params.b, params.c].map((s) => s?.trim()).filter((s): s is string => Boolean(s));
  const slugs = [...new Set(rawSlugs)].slice(0, MAX_COMPARE_CAREERS);

  if (slugs.length < MIN_COMPARE_CAREERS) {
    return (
      <Section tone="muted" className="pt-10 sm:pt-14">
        <PageIntro />
        <Card className="mt-6">
          <ComparePicker options={options} selected={selectedForPicker} />
        </Card>
        <Card className="mt-6 flex flex-col items-center gap-3 py-14 text-center">
          <Scale aria-hidden="true" className="h-10 w-10 text-muted" />
          <h2 className="text-lg font-semibold text-primary">Pick at least two careers to compare</h2>
          <p className="max-w-sm text-sm text-muted">
            Choose two or three careers above to see them side by side — relevant subjects, skills, education
            routes, and characteristics.
          </p>
        </Card>
      </Section>
    );
  }

  const careerResults = await Promise.all(slugs.map((slug) => getCareerBySlug(slug)));
  const careers = careerResults.filter((c): c is NonNullable<(typeof careerResults)[number]> => c !== null);
  const missingCount = slugs.length - careers.length;

  if (careers.length < MIN_COMPARE_CAREERS) {
    return (
      <Section tone="muted" className="pt-10 sm:pt-14">
        <PageIntro />
        <Card className="mt-6">
          <ComparePicker options={options} selected={selectedForPicker} />
        </Card>
        <Card className="mt-6 flex flex-col items-center gap-3 py-14 text-center">
          <TriangleAlert aria-hidden="true" className="h-10 w-10 text-muted" />
          <h2 className="text-lg font-semibold text-primary">One or more selected careers couldn&apos;t be found</h2>
          <p className="max-w-sm text-sm text-muted">
            A career may have been removed or renamed. Pick your careers again above.
          </p>
        </Card>
      </Section>
    );
  }

  const snapshot = await getStudentProfileSnapshot();
  let matches: Map<string, RecommendationResult> | null = null;
  if (snapshot && hasMinimumProfileDataForRecommendations(snapshot)) {
    const matchProfiles = careers.map(careerDetailToMatchProfile);
    const { results } = getRecommendations(snapshot, matchProfiles, matchProfiles.length);
    matches = new Map(results.map((r) => [r.careerId, r]));
  }

  const matrix = buildComparisonMatrix(careers, matches);

  const removeHrefs = careers.map((career) => {
    const remaining = slugs.filter((s) => s !== career.slug);
    const p = new URLSearchParams();
    if (remaining[0]) p.set("a", remaining[0]);
    if (remaining[1]) p.set("b", remaining[1]);
    return `/compare?${p.toString()}`;
  });

  return (
    <Section tone="muted" className="pt-10 sm:pt-14">
      <PageIntro />

      {missingCount > 0 ? (
        <Card className="mt-6 border-warning/25 bg-warning-light text-sm text-warning">
          {missingCount === 1 ? "One selected career" : `${missingCount} selected careers`} couldn&apos;t be found and
          {missingCount === 1 ? " was" : " were"} left out below.
        </Card>
      ) : null}

      <Card className="mt-6">
        <ComparePicker options={options} selected={selectedForPicker} />
      </Card>

      <div className="mt-6">
        <ComparisonTable matrix={matrix} removeHrefs={removeHrefs} />
      </div>

      <GuidanceNotice className="mt-8">
        {matrix.hasPersonalizedMatch
          ? "“Your match” reuses the same deterministic, rules-based comparison as /recommendations — it's not a scientifically validated assessment or AI-generated, and a lower match isn't a verdict that a career is unsuitable for you. "
          : null}
        Career characteristics and education routes shown here are curated heuristics, not verified market data,
        salary guarantees, or admissions advice. Sign in and complete your Student Digital Profile to see how each
        of these careers matches your own profile.
      </GuidanceNotice>
    </Section>
  );
}

function PageIntro() {
  return (
    <div className="mb-2">
      <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Compare</p>
      <h1 className="mt-2 text-3xl font-semibold text-primary balance sm:text-4xl">Compare careers side by side</h1>
      <p className="mt-2 max-w-2xl text-muted">
        See how two or three careers stack up on relevant subjects, skills, education routes, and characteristics —
        useful whether or not you&apos;re signed in.
      </p>
    </div>
  );
}
