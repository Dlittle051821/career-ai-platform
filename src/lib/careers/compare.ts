import type { CareerDetail, CareerMatchProfile } from "@/types/career";
import type { MatchBand, RecommendationResult } from "@/lib/recommendations";
import { MATCH_BAND_LABELS } from "@/lib/recommendations";
import { subjectLabel, interestLabel, skillLabel, educationLevelLabel, fieldLabel, SKILL_LEVEL_LABELS, RELEVANCE_LABELS } from "./labels";
import { deriveCareerCharacteristics } from "./characteristics";

/**
 * Milestone 6 — Career Comparison.
 *
 * Pure, deterministic, framework-independent (no Next.js/React/Supabase
 * imports) transform from a small list of `CareerDetail` objects into a
 * display-ready comparison matrix. Same inputs always produce the same
 * output; never mutates the careers (or match results) it's given.
 *
 * Follows the same "no raw numbers" convention as the career detail page
 * and docs/career-data-guide.md §7: subjects/interests are binned into
 * Core/Also relevant (importance >= CORE_IMPORTANCE_THRESHOLD, matching
 * `src/app/careers/[slug]/page.tsx`), skill levels and education-route
 * relevance are shown as their existing qualitative labels, and
 * `careers.scores.*` never appears as a number — only as the same
 * qualitative characteristic chips `deriveCareerCharacteristics` already
 * produces for the detail page. Nothing here invents a new number the rest
 * of the app doesn't already treat as safe to show.
 */

export const MAX_COMPARE_CAREERS = 3;
export const MIN_COMPARE_CAREERS = 2;

/**
 * Adapts an already-fetched `CareerDetail` (the shape `getCareerBySlug`
 * returns) into the `CareerMatchProfile` shape the Milestone 5 scoring
 * engine expects. Only exists so `/compare` can show each selected
 * career's personalized match band without a second database round trip —
 * `getCareersForMatching()` bulk-loads the ENTIRE catalogue, which would be
 * wasteful just to score the 2-3 careers already on screen. Pure field
 * reshaping only: no new data, no computation, no mutation of `detail`.
 */
export function careerDetailToMatchProfile(detail: CareerDetail): CareerMatchProfile {
  return {
    id: detail.id,
    careerKey: detail.careerKey,
    slug: detail.slug,
    title: detail.title,
    shortTitle: detail.shortTitle,
    summary: detail.summary,
    familyKey: detail.familyKey,
    familyName: detail.familyName,
    isFeatured: detail.isFeatured,
    minimumEducationKey: detail.minimumEducationKey,
    scores: detail.scores,
    subjects: detail.subjects,
    interests: detail.interests,
    skills: detail.skills,
    workPreferences: detail.workPreferences,
    careerPriorities: detail.careerPriorities,
    educationRoutes: detail.educationRoutes,
    industryKeys: detail.industries.map((i) => i.industryKey),
    tagKeys: detail.tags.map((t) => t.tagKey),
  };
}

/** Matches the "Core" cutoff used on the career detail page for subjects/interests. */
const CORE_IMPORTANCE_THRESHOLD = 4;

export type ComparisonSectionKey = "subjects" | "interests" | "skills" | "education" | "characteristics" | "industries" | "tags" | "match";

export interface ComparisonHeader {
  id: string;
  slug: string;
  title: string;
  familyName: string;
}

export interface ComparisonRow {
  key: string;
  label: string;
  /** One entry per compared career, same order as `ComparisonMatrix.careers`. Empty string means "not applicable to this career". */
  cells: string[];
  /** Indexes (into `cells`/`careers`) that stand out on this row — see each section's builder below for what "stands out" means there. Empty array means no highlight for this row. */
  highlightIndexes: number[];
}

export interface ComparisonSection {
  key: ComparisonSectionKey;
  label: string;
  rows: ComparisonRow[];
}

export interface ComparisonMatrix {
  careers: ComparisonHeader[];
  sections: ComparisonSection[];
  hasPersonalizedMatch: boolean;
}

/** Collects the union of a key across careers, in first-seen order (iterate careers in order, then each career's own array order) — deterministic and stable across runs. */
function unionKeysInFirstSeenOrder<T>(careers: CareerDetail[], pick: (career: CareerDetail) => { key: string; item: T }[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const career of careers) {
    for (const { key } of pick(career)) {
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(key);
      }
    }
  }
  return ordered;
}

function buildSubjectsSection(careers: CareerDetail[]): ComparisonSection {
  const keys = unionKeysInFirstSeenOrder(careers, (c) => c.subjects.map((s) => ({ key: s.subjectKey, item: s })));
  const rows: ComparisonRow[] = keys.map((key) => {
    const cells = careers.map((career) => {
      const req = career.subjects.find((s) => s.subjectKey === key);
      if (!req) return "";
      return req.importance >= CORE_IMPORTANCE_THRESHOLD ? "Core" : "Also relevant";
    });
    const highlightIndexes = careers
      .map((career, i) => ({ i, req: career.subjects.find((s) => s.subjectKey === key) }))
      .filter((x) => x.req && x.req.importance >= CORE_IMPORTANCE_THRESHOLD)
      .map((x) => x.i);
    return { key, label: subjectLabel(key), cells, highlightIndexes };
  });
  return { key: "subjects", label: "Relevant subjects", rows };
}

function buildInterestsSection(careers: CareerDetail[]): ComparisonSection {
  const keys = unionKeysInFirstSeenOrder(careers, (c) => c.interests.map((i) => ({ key: i.interestKey, item: i })));
  const rows: ComparisonRow[] = keys.map((key) => {
    const cells = careers.map((career) => {
      const req = career.interests.find((i) => i.interestKey === key);
      if (!req) return "";
      return req.importance >= CORE_IMPORTANCE_THRESHOLD ? "Core" : "Also relevant";
    });
    const highlightIndexes = careers
      .map((career, i) => ({ i, req: career.interests.find((x) => x.interestKey === key) }))
      .filter((x) => x.req && x.req.importance >= CORE_IMPORTANCE_THRESHOLD)
      .map((x) => x.i);
    return { key, label: interestLabel(key), cells, highlightIndexes };
  });
  return { key: "interests", label: "Relevant interests", rows };
}

const SKILL_LEVEL_ORDER: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3 };

function buildSkillsSection(careers: CareerDetail[]): ComparisonSection {
  const keys = unionKeysInFirstSeenOrder(careers, (c) => c.skills.map((s) => ({ key: s.skillKey, item: s })));
  const rows: ComparisonRow[] = keys.map((key) => {
    const cells = careers.map((career) => {
      const req = career.skills.find((s) => s.skillKey === key);
      if (!req) return "";
      return SKILL_LEVEL_LABELS[req.recommendedLevel] ?? req.recommendedLevel;
    });
    // Highlight the career(s) that call for the most advanced level of this skill — informational ("asks for more depth here"), not a value judgment.
    const highlightIndexes = careers
      .map((career, i) => ({ i, req: career.skills.find((s) => s.skillKey === key) }))
      .filter((x) => x.req && SKILL_LEVEL_ORDER[x.req.recommendedLevel] === 3)
      .map((x) => x.i);
    return { key, label: skillLabel(key), cells, highlightIndexes };
  });
  return { key: "skills", label: "Useful skills", rows };
}

function buildEducationSection(careers: CareerDetail[]): ComparisonSection {
  const rows: ComparisonRow[] = [
    {
      key: "minimum_education",
      label: "Typical minimum education",
      cells: careers.map((c) => (c.minimumEducationKey ? educationLevelLabel(c.minimumEducationKey) : "")),
      highlightIndexes: [],
    },
  ];

  const keys = unionKeysInFirstSeenOrder(careers, (c) => c.educationRoutes.map((r) => ({ key: `${r.educationLevel}::${r.fieldKey}`, item: r })));
  for (const key of keys) {
    const [educationLevel, fieldKey] = key.split("::");
    const cells = careers.map((career) => {
      const route = career.educationRoutes.find((r) => r.educationLevel === educationLevel && r.fieldKey === fieldKey);
      return route ? (RELEVANCE_LABELS[route.relevance] ?? route.relevance) : "";
    });
    const highlightIndexes = careers
      .map((career, i) => ({ i, route: career.educationRoutes.find((r) => r.educationLevel === educationLevel && r.fieldKey === fieldKey) }))
      .filter((x) => x.route?.relevance === "primary")
      .map((x) => x.i);
    rows.push({ key, label: `${educationLevelLabel(educationLevel)} — ${fieldLabel(fieldKey)}`, cells, highlightIndexes });
  }

  return { key: "education", label: "Education routes", rows };
}

function buildCharacteristicsSection(careers: CareerDetail[]): ComparisonSection {
  const perCareerChips = careers.map((c) => new Set(deriveCareerCharacteristics(c.scores, 11)));
  const keys = unionKeysInFirstSeenOrder(careers, (c) => deriveCareerCharacteristics(c.scores, 11).map((label) => ({ key: label, item: label })));
  const rows: ComparisonRow[] = keys.map((label) => ({
    key: label,
    label,
    cells: perCareerChips.map((chips) => (chips.has(label) ? "Yes" : "")),
    // Presence-only (the underlying score is never shown as a number) — no career is "highlighted" over another for simply having a trait.
    highlightIndexes: [],
  }));
  return { key: "characteristics", label: "Career characteristics", rows };
}

function buildLabeledSetSection(careers: CareerDetail[], key: ComparisonSectionKey, label: string, pick: (c: CareerDetail) => { key: string; label: string }[]): ComparisonSection {
  const labelByKey = new Map<string, string>();
  for (const career of careers) for (const item of pick(career)) labelByKey.set(item.key, item.label);
  const keys = unionKeysInFirstSeenOrder(careers, (c) => pick(c).map((item) => ({ key: item.key, item })));
  const rows: ComparisonRow[] = keys.map((k) => ({
    key: k,
    label: labelByKey.get(k) ?? k,
    cells: careers.map((c) => (pick(c).some((item) => item.key === k) ? "Yes" : "")),
    highlightIndexes: [],
  }));
  return { key, label, rows };
}

const MATCH_BAND_RANK: Record<MatchBand, number> = {
  strong_match: 3,
  promising_match: 2,
  worth_exploring: 1,
  limited_evidence: 0,
};

function buildMatchSection(careers: CareerDetail[], matches: Map<string, RecommendationResult>): ComparisonSection {
  const cells = careers.map((c) => {
    const match = matches.get(c.id);
    return match ? MATCH_BAND_LABELS[match.matchBand] : "";
  });
  const ranked = careers.map((c, i) => ({ i, rank: matches.has(c.id) ? MATCH_BAND_RANK[matches.get(c.id)!.matchBand] : -1 }));
  const best = Math.max(...ranked.map((r) => r.rank));
  const highlightIndexes = best >= 0 ? ranked.filter((r) => r.rank === best).map((r) => r.i) : [];

  return {
    key: "match",
    label: "Your match",
    rows: [{ key: "match_band", label: "Match for your profile", cells, highlightIndexes }],
  };
}

/**
 * Builds the full comparison matrix for 2-3 careers. `matches`, when
 * provided, is a career-id-keyed map of that career's already-computed M5
 * `RecommendationResult` for the current student — this function never
 * scores anything itself, it only displays a result the recommendation
 * engine already produced (see `src/app/compare/page.tsx`), keeping the
 * "no scoring outside the engine" boundary from Milestone 5 intact.
 */
export function buildComparisonMatrix(careers: CareerDetail[], matches: Map<string, RecommendationResult> | null = null): ComparisonMatrix {
  const headers: ComparisonHeader[] = careers.map((c) => ({ id: c.id, slug: c.slug, title: c.title, familyName: c.familyName }));

  const sections: ComparisonSection[] = [
    buildSubjectsSection(careers),
    buildInterestsSection(careers),
    buildSkillsSection(careers),
    buildEducationSection(careers),
    buildCharacteristicsSection(careers),
    buildLabeledSetSection(careers, "industries", "Industries", (c) => c.industries.map((ind) => ({ key: ind.id, label: ind.name }))),
    buildLabeledSetSection(careers, "tags", "Tags", (c) => c.tags.map((t) => ({ key: t.id, label: t.label }))),
  ];

  const hasPersonalizedMatch = matches !== null && matches.size > 0;
  if (hasPersonalizedMatch) {
    sections.unshift(buildMatchSection(careers, matches!));
  }

  return { careers: headers, sections, hasPersonalizedMatch };
}
