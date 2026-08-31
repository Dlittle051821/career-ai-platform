/**
 * Trusted Global Course Search — hand-curated subject and degree-level
 * taxonomy. Pure TypeScript data + normalization logic, no DB access, no
 * side effects — same "pure, framework-free" convention as every other
 * module in src/lib/education/ (see normalize.ts/search.ts).
 *
 * WHY HAND-CURATED, NOT A FUZZY-MATCHING LIBRARY: the spec requires an
 * exact, auditable distinction between "this is the subject the student
 * asked for" and "this is a related subject" — "Do not silently replace
 * an exact subject with a related subject." A similarity-scoring/fuzzy
 * library (Levenshtein distance, embeddings, etc.) produces a confidence
 * SCORE, not a guaranteed category — it can silently blur exact and
 * related matches as thresholds drift, and any given score is not
 * something a non-technical admin can review or edit. A small, explicit,
 * versioned table of {canonical label, exact aliases, related subjects,
 * common misspellings} is auditable line-by-line, testable exhaustively
 * (every alias/misspelling in this file has a corresponding unit test),
 * and never guesses at a distinction it does not actually know — a term
 * this taxonomy has never seen simply falls through to "unmatched"
 * (still searchable via the internal full-text query and via the
 * provider's own official search), rather than being fuzzily coerced
 * into the nearest-sounding entry.
 *
 * Deliberately SMALL: only Mechanical Engineering is fully populated per
 * the spec's worked example; a handful of other common subjects are
 * included so the search UI isn't a one-subject demo, not to claim broad
 * subject coverage. Extending this table (a new object literal) never
 * requires touching the resolution logic below.
 */

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

export interface SubjectTaxonomyEntry {
  /** Stable slug — also used as the DB-facing `canonical_subject_id` text value in external_search_mappings (see supabase/migrations/0009_trusted_course_search.sql). Never reused for a different subject once seeded/mapped. */
  id: string;
  /** The one display value every UI/report must show for this subject — never re-derived from the user's raw input. */
  canonicalLabel: string;
  /**
   * Free-text phrases that normalize to an EXACT match for this subject
   * (case-insensitive, whitespace-collapsed). The canonical label itself is
   * always an implicit exact alias and does not need to be repeated here.
   */
  exactAliases: string[];
  /**
   * Ids of OTHER taxonomy entries that are related to this subject but are
   * never treated as the same subject — surfaced to the student as "Related
   * subjects", clearly separate from the exact match, never substituted for
   * it.
   */
  relatedSubjectIds: string[];
  /** Common misspellings that should still resolve to an EXACT match (the taxonomy corrects the typo — it does not treat a misspelling as a different, unmatched term). */
  misspellings: string[];
}

export const SUBJECT_TAXONOMY: readonly SubjectTaxonomyEntry[] = [
  {
    id: "mechanical-engineering",
    canonicalLabel: "Mechanical Engineering",
    exactAliases: ["mechanical engineering", "mechanical engineer", "mechanical"],
    relatedSubjectIds: ["mechatronics", "automotive-engineering", "manufacturing-engineering"],
    misspellings: ["machanical engineering", "mechnical engineering", "mechanical engg"],
  },
  {
    id: "mechatronics",
    canonicalLabel: "Mechatronics",
    exactAliases: ["mechatronics", "mechatronics engineering"],
    relatedSubjectIds: ["mechanical-engineering"],
    misspellings: [],
  },
  {
    id: "automotive-engineering",
    canonicalLabel: "Automotive Engineering",
    exactAliases: ["automotive engineering", "automotive engineer"],
    relatedSubjectIds: ["mechanical-engineering"],
    misspellings: [],
  },
  {
    id: "manufacturing-engineering",
    canonicalLabel: "Manufacturing Engineering",
    exactAliases: ["manufacturing engineering"],
    relatedSubjectIds: ["mechanical-engineering"],
    misspellings: [],
  },
  {
    id: "computer-science",
    canonicalLabel: "Computer Science",
    exactAliases: ["computer science", "cs", "computing"],
    relatedSubjectIds: ["data-science", "software-engineering"],
    misspellings: ["computre science", "compuer science"],
  },
  {
    id: "software-engineering",
    canonicalLabel: "Software Engineering",
    exactAliases: ["software engineering", "software engineer"],
    relatedSubjectIds: ["computer-science"],
    misspellings: [],
  },
  {
    id: "data-science",
    canonicalLabel: "Data Science",
    exactAliases: ["data science"],
    relatedSubjectIds: ["computer-science"],
    misspellings: [],
  },
  {
    id: "civil-engineering",
    canonicalLabel: "Civil Engineering",
    exactAliases: ["civil engineering", "civil engineer"],
    relatedSubjectIds: ["structural-engineering"],
    misspellings: ["civl engineering"],
  },
  {
    id: "structural-engineering",
    canonicalLabel: "Structural Engineering",
    exactAliases: ["structural engineering"],
    relatedSubjectIds: ["civil-engineering"],
    misspellings: [],
  },
  {
    id: "electrical-engineering",
    canonicalLabel: "Electrical Engineering",
    exactAliases: ["electrical engineering", "electrical engineer", "eee"],
    relatedSubjectIds: ["electronics-engineering"],
    misspellings: ["electrcial engineering"],
  },
  {
    id: "electronics-engineering",
    canonicalLabel: "Electronics Engineering",
    exactAliases: ["electronics engineering", "electronic engineering"],
    relatedSubjectIds: ["electrical-engineering"],
    misspellings: [],
  },
  {
    id: "business-administration",
    canonicalLabel: "Business Administration",
    exactAliases: ["business administration", "business admin", "mba", "bba"],
    relatedSubjectIds: [],
    misspellings: ["buisness administration"],
  },
] as const;

const SUBJECT_BY_ID = new Map<string, SubjectTaxonomyEntry>(SUBJECT_TAXONOMY.map((s) => [s.id, s]));

export function getSubjectById(id: string): SubjectTaxonomyEntry | null {
  return SUBJECT_BY_ID.get(id) ?? null;
}

/** Lowercase, collapse internal whitespace, trim — the ONLY transform applied before alias/misspelling comparison. Never strips punctuation beyond whitespace collapsing, so this stays a small, predictable table lookup rather than a fuzzy match. */
function normalizeForMatching(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, " ").trim();
}

// Reverse indexes, built once at module load — O(1) lookups, and the only
// place the taxonomy array above is ever iterated.
const EXACT_ALIAS_INDEX = new Map<string, SubjectTaxonomyEntry>();
const MISSPELLING_INDEX = new Map<string, SubjectTaxonomyEntry>();
for (const entry of SUBJECT_TAXONOMY) {
  EXACT_ALIAS_INDEX.set(normalizeForMatching(entry.canonicalLabel), entry);
  for (const alias of entry.exactAliases) {
    EXACT_ALIAS_INDEX.set(normalizeForMatching(alias), entry);
  }
  for (const misspelling of entry.misspellings) {
    MISSPELLING_INDEX.set(normalizeForMatching(misspelling), entry);
  }
}

export type SubjectMatchSource = "exact_alias" | "misspelling_correction";

export interface SubjectResolution {
  /** The raw input as given, unmodified. */
  rawInput: string;
  /** The exact-matched taxonomy entry, or null if nothing in the taxonomy matches — an unmatched term is never coerced into a "closest" subject. */
  exactMatch: SubjectTaxonomyEntry | null;
  /** How exactMatch was found — undefined when exactMatch is null. "misspelling_correction" means the raw input was a known typo that was corrected to the canonical spelling, NOT a fuzzy/probabilistic guess. */
  matchSource?: SubjectMatchSource;
  /** Entries related to exactMatch — always a separate, clearly-labelled list, never merged into exactMatch. Empty when exactMatch is null or has no related subjects. */
  relatedSubjects: SubjectTaxonomyEntry[];
}

/**
 * Resolves free-text subject input against the taxonomy. Returns exactly
 * one of: an exact match (with its related-subject list attached
 * separately), or no match at all — this function never returns a
 * "related" entry as though it were the exact match.
 */
export function resolveSubject(raw: string | null | undefined): SubjectResolution {
  const rawInput = raw ?? "";
  if (!rawInput.trim()) {
    return { rawInput, exactMatch: null, relatedSubjects: [] };
  }
  const normalized = normalizeForMatching(rawInput);

  const direct = EXACT_ALIAS_INDEX.get(normalized);
  if (direct) {
    return {
      rawInput,
      exactMatch: direct,
      matchSource: "exact_alias",
      relatedSubjects: direct.relatedSubjectIds.map((id) => getSubjectById(id)).filter((s): s is SubjectTaxonomyEntry => !!s),
    };
  }

  const corrected = MISSPELLING_INDEX.get(normalized);
  if (corrected) {
    return {
      rawInput,
      exactMatch: corrected,
      matchSource: "misspelling_correction",
      relatedSubjects: corrected.relatedSubjectIds.map((id) => getSubjectById(id)).filter((s): s is SubjectTaxonomyEntry => !!s),
    };
  }

  return { rawInput, exactMatch: null, relatedSubjects: [] };
}

// ---------------------------------------------------------------------------
// Degree levels
// ---------------------------------------------------------------------------

/** Canonical degree-level ids — the vocabulary every part of this feature (adapter, DB `degree_level` columns, UI) speaks. */
export const CANONICAL_DEGREE_LEVELS = ["bachelors", "masters", "doctorate", "diploma_certificate", "other"] as const;
export type CanonicalDegreeLevel = (typeof CANONICAL_DEGREE_LEVELS)[number];

export const DEGREE_LEVEL_LABELS: Record<CanonicalDegreeLevel, string> = {
  bachelors: "Bachelor's",
  masters: "Master's",
  doctorate: "Doctorate",
  diploma_certificate: "Diploma or certificate",
  other: "Other",
};

/**
 * Maps a canonical degree level onto the EXISTING `courses.education_level`
 * CHECK-constrained values (supabase/migrations/0004_admin_system.sql) —
 * `diploma_certificate` maps to BOTH `diploma` and `certificate` since the
 * spec's canonical list merges them into one option ("Diploma/certificate")
 * while the pre-existing courses table keeps them as two distinct values.
 * Used only to query the internal NextWise course catalogue with the
 * student's canonical selection — never used to CHANGE what a course's own
 * education_level value is.
 */
export const CANONICAL_DEGREE_TO_EDUCATION_LEVELS: Record<CanonicalDegreeLevel, string[]> = {
  bachelors: ["undergraduate"],
  masters: ["postgraduate"],
  doctorate: ["doctorate"],
  diploma_certificate: ["diploma", "certificate"],
  other: ["other"],
};

const DEGREE_EXACT_ALIASES: Record<CanonicalDegreeLevel, string[]> = {
  bachelors: ["bachelor's", "bachelors", "bachelor", "undergraduate", "ba", "bsc", "beng", "btech"],
  masters: ["master's", "masters", "master", "postgraduate", "ma", "msc", "meng", "mtech", "mba"],
  doctorate: ["doctorate", "phd", "ph.d", "ph.d.", "doctoral"],
  diploma_certificate: ["diploma", "certificate", "diploma/certificate", "diploma or certificate"],
  other: ["other"],
};

const DEGREE_MISSPELLINGS: Record<CanonicalDegreeLevel, string[]> = {
  bachelors: ["bachlors", "bachelor", "bachelors"],
  masters: [],
  doctorate: [],
  diploma_certificate: [],
  other: [],
};
// Note: "bachelor" and "bachelors" (no apostrophe) intentionally appear in
// BOTH the exact-alias and misspelling lists above — they are common enough
// spellings that either index resolving them is correct; the misspelling
// list exists primarily so this file's own tests can assert the spec's
// exact examples ("bachlors", "bachelor", "bachelors") all normalize to
// "Bachelor's".

const DEGREE_EXACT_INDEX = new Map<string, CanonicalDegreeLevel>();
const DEGREE_MISSPELLING_INDEX = new Map<string, CanonicalDegreeLevel>();
for (const level of CANONICAL_DEGREE_LEVELS) {
  DEGREE_EXACT_INDEX.set(normalizeForMatching(DEGREE_LEVEL_LABELS[level]), level);
  for (const alias of DEGREE_EXACT_ALIASES[level]) {
    DEGREE_EXACT_INDEX.set(normalizeForMatching(alias), level);
  }
  for (const misspelling of DEGREE_MISSPELLINGS[level]) {
    DEGREE_MISSPELLING_INDEX.set(normalizeForMatching(misspelling), level);
  }
}

export interface DegreeLevelResolution {
  rawInput: string;
  canonicalLevel: CanonicalDegreeLevel | null;
  matchSource?: SubjectMatchSource;
}

/** Same exact-alias-then-misspelling-correction resolution strategy as resolveSubject() — a degree level is either recognized exactly (after typo correction) or not recognized at all. */
export function resolveDegreeLevel(raw: string | null | undefined): DegreeLevelResolution {
  const rawInput = raw ?? "";
  if (!rawInput.trim()) return { rawInput, canonicalLevel: null };
  const normalized = normalizeForMatching(rawInput);

  const direct = DEGREE_EXACT_INDEX.get(normalized);
  if (direct) return { rawInput, canonicalLevel: direct, matchSource: "exact_alias" };

  const corrected = DEGREE_MISSPELLING_INDEX.get(normalized);
  if (corrected) return { rawInput, canonicalLevel: corrected, matchSource: "misspelling_correction" };

  return { rawInput, canonicalLevel: null };
}

/** Also accepts an already-canonical `courses.education_level` value (e.g. from a stored filter) and maps it back to the taxonomy's canonical degree level — the inverse of CANONICAL_DEGREE_TO_EDUCATION_LEVELS, used when a URL/search param already carries the DB's own vocabulary. */
export function educationLevelToCanonicalDegree(educationLevel: string | null | undefined): CanonicalDegreeLevel | null {
  if (!educationLevel) return null;
  for (const level of CANONICAL_DEGREE_LEVELS) {
    if (CANONICAL_DEGREE_TO_EDUCATION_LEVELS[level].includes(educationLevel)) return level;
  }
  return null;
}
