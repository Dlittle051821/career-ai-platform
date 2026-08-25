/**
 * Milestone 4 career seed data validator.
 *
 * Run with: npm run validate:careers
 *
 * Checks every entry in `ALL_CAREERS` (src/data/careers/index.ts) against
 * the taxonomy in src/data/careers/taxonomy.ts and the M3 taxonomy it
 * re-exports from src/data/profile-options.ts. Fails loudly (non-zero exit
 * code, one line per problem) on:
 *
 *  - duplicate careerKey / slug (across ALL files, not just within one)
 *  - unknown family / subject / interest / skill / work-preference /
 *    career-priority / education-level / field / industry / tag key
 *  - unknown relatedCareerKeys reference
 *  - scores outside 1-5 (careers.scores, subject/interest/skill importance,
 *    work-preference score, career-priority score)
 *  - missing required fields (title, summary, whatYouDo, typicalEnvironment,
 *    typicalEntryLevel, slug, careerKey, familyKey)
 *  - "approved" careers that don't meet the Milestone 4 §37 minimum:
 *    title, family, summary, >=2 subjects, >=3 interests, >=3 skills,
 *    >=1 work-preference entry, >=1 career-priority entry,
 *    >=1 education route, >=1 industry
 *
 * This does not touch a live Supabase project — it is a pure static check
 * over the TypeScript seed files.
 */

import {
  ALL_CAREERS,
} from "../src/data/careers/index";
import {
  VALID_FAMILY_KEYS,
  VALID_SUBJECT_KEYS,
  VALID_INTEREST_KEYS,
  VALID_SKILL_KEYS,
  VALID_WORK_PREFERENCE_KEYS,
  VALID_CAREER_PRIORITY_KEYS,
  VALID_EDUCATION_LEVEL_KEYS,
  VALID_FIELD_KEYS,
  VALID_INDUSTRY_KEYS,
  VALID_TAG_KEYS,
} from "../src/data/careers/taxonomy";

type Problem = { level: "error" | "warning"; careerKey: string; message: string };

const problems: Problem[] = [];

function err(careerKey: string, message: string) {
  problems.push({ level: "error", careerKey, message });
}
function warn(careerKey: string, message: string) {
  problems.push({ level: "warning", careerKey, message });
}

function inRange(n: number | undefined, min: number, max: number): boolean {
  if (n === undefined) return true;
  return Number.isFinite(n) && n >= min && n <= max;
}

// ---------------------------------------------------------------------------
// 1. Cross-file uniqueness
// ---------------------------------------------------------------------------
const seenKeys = new Map<string, number>();
const seenSlugs = new Map<string, number>();

ALL_CAREERS.forEach((c, i) => {
  if (!c.careerKey) {
    err(`<index ${i}>`, "missing careerKey");
    return;
  }
  if (seenKeys.has(c.careerKey)) {
    err(c.careerKey, `duplicate careerKey (also at index ${seenKeys.get(c.careerKey)}, this one at ${i})`);
  } else {
    seenKeys.set(c.careerKey, i);
  }

  if (!c.slug) {
    err(c.careerKey, "missing slug");
  } else if (seenSlugs.has(c.slug)) {
    err(c.careerKey, `duplicate slug "${c.slug}" (also used by index ${seenSlugs.get(c.slug)})`);
  } else {
    seenSlugs.set(c.slug, i);
  }
});

// ---------------------------------------------------------------------------
// 2. Per-career checks
// ---------------------------------------------------------------------------
const allCareerKeys = new Set(ALL_CAREERS.map((c) => c.careerKey));

for (const c of ALL_CAREERS) {
  const key = c.careerKey ?? "<unknown>";

  // Required fields
  for (const field of ["title", "summary", "whatYouDo", "typicalEnvironment", "typicalEntryLevel", "slug", "familyKey"] as const) {
    const v = c[field];
    if (!v || (typeof v === "string" && v.trim().length === 0)) {
      err(key, `missing required field "${field}"`);
    }
  }

  // Family
  if (c.familyKey && !VALID_FAMILY_KEYS.includes(c.familyKey)) {
    err(key, `unknown familyKey "${c.familyKey}"`);
  }

  // minimumEducationKey (optional) must be a valid education level
  if (c.minimumEducationKey && !VALID_EDUCATION_LEVEL_KEYS.includes(c.minimumEducationKey)) {
    err(key, `unknown minimumEducationKey "${c.minimumEducationKey}"`);
  }

  // Scores 1-5
  if (c.scores) {
    for (const [scoreName, val] of Object.entries(c.scores)) {
      if (!inRange(val as number | undefined, 1, 5)) {
        err(key, `scores.${scoreName} = ${val} is out of range 1-5`);
      }
    }
  }

  // Subjects
  (c.subjects ?? []).forEach((s, i) => {
    if (!VALID_SUBJECT_KEYS.includes(s.subjectKey)) {
      err(key, `subjects[${i}] unknown subjectKey "${s.subjectKey}"`);
    }
    if (!inRange(s.importance, 1, 5)) {
      err(key, `subjects[${i}] (${s.subjectKey}) importance ${s.importance} out of range 1-5`);
    }
    if (!inRange(s.minimumStrength, 1, 5)) {
      err(key, `subjects[${i}] (${s.subjectKey}) minimumStrength ${s.minimumStrength} out of range 1-5`);
    }
  });

  // Interests
  (c.interests ?? []).forEach((s, i) => {
    if (!VALID_INTEREST_KEYS.includes(s.interestKey)) {
      err(key, `interests[${i}] unknown interestKey "${s.interestKey}"`);
    }
    if (!inRange(s.importance, 1, 5)) {
      err(key, `interests[${i}] (${s.interestKey}) importance ${s.importance} out of range 1-5`);
    }
  });

  // Skills
  (c.skills ?? []).forEach((s, i) => {
    if (!VALID_SKILL_KEYS.includes(s.skillKey)) {
      err(key, `skills[${i}] unknown skillKey "${s.skillKey}"`);
    }
    if (!inRange(s.importance, 1, 5)) {
      err(key, `skills[${i}] (${s.skillKey}) importance ${s.importance} out of range 1-5`);
    }
    if (!["beginner", "intermediate", "advanced"].includes(s.recommendedLevel)) {
      err(key, `skills[${i}] (${s.skillKey}) invalid recommendedLevel "${s.recommendedLevel}"`);
    }
  });

  // Work preferences
  (c.workPreferences ?? []).forEach((s, i) => {
    if (!VALID_WORK_PREFERENCE_KEYS.includes(s.preferenceKey)) {
      err(key, `workPreferences[${i}] unknown preferenceKey "${s.preferenceKey}"`);
    }
    if (!inRange(s.score, 1, 5)) {
      err(key, `workPreferences[${i}] (${s.preferenceKey}) score ${s.score} out of range 1-5`);
    }
  });

  // Career priorities
  (c.careerPriorities ?? []).forEach((s, i) => {
    if (!VALID_CAREER_PRIORITY_KEYS.includes(s.priorityKey)) {
      err(key, `careerPriorities[${i}] unknown priorityKey "${s.priorityKey}"`);
    }
    if (!inRange(s.score, 1, 5)) {
      err(key, `careerPriorities[${i}] (${s.priorityKey}) score ${s.score} out of range 1-5`);
    }
  });

  // Education routes
  (c.educationRoutes ?? []).forEach((r, i) => {
    if (!VALID_EDUCATION_LEVEL_KEYS.includes(r.educationLevel)) {
      err(key, `educationRoutes[${i}] unknown educationLevel "${r.educationLevel}"`);
    }
    if (!VALID_FIELD_KEYS.includes(r.fieldKey)) {
      err(key, `educationRoutes[${i}] unknown fieldKey "${r.fieldKey}"`);
    }
    if (r.specializationKey && !VALID_FIELD_KEYS.includes(r.specializationKey)) {
      err(key, `educationRoutes[${i}] unknown specializationKey "${r.specializationKey}"`);
    }
    if (!["primary", "common", "alternative"].includes(r.relevance)) {
      err(key, `educationRoutes[${i}] invalid relevance "${r.relevance}"`);
    }
  });

  // Industries
  (c.industryKeys ?? []).forEach((ik, i) => {
    if (!VALID_INDUSTRY_KEYS.includes(ik)) {
      err(key, `industryKeys[${i}] unknown industryKey "${ik}"`);
    }
  });

  // Tags
  (c.tagKeys ?? []).forEach((tk, i) => {
    if (!VALID_TAG_KEYS.includes(tk)) {
      err(key, `tagKeys[${i}] unknown tagKey "${tk}"`);
    }
  });

  // Related careers must point at real careers (and not itself)
  (c.relatedCareerKeys ?? []).forEach((rk) => {
    if (rk === c.careerKey) {
      err(key, `relatedCareerKeys references itself ("${rk}")`);
    } else if (!allCareerKeys.has(rk)) {
      err(key, `relatedCareerKeys references unknown careerKey "${rk}"`);
    }
  });

  // ---------------------------------------------------------------------
  // Milestone 4 §37 — minimum metadata for "approved" status
  // ---------------------------------------------------------------------
  if (c.dataQualityStatus === "approved") {
    if (!c.title) err(key, "approved career missing title");
    if (!c.familyKey) err(key, "approved career missing familyKey");
    if (!c.summary) err(key, "approved career missing summary");
    if ((c.subjects ?? []).length < 2) warn(key, `approved career has only ${c.subjects?.length ?? 0} subject(s), needs >= 2`);
    if ((c.interests ?? []).length < 3) warn(key, `approved career has only ${c.interests?.length ?? 0} interest(s), needs >= 3`);
    if ((c.skills ?? []).length < 3) warn(key, `approved career has only ${c.skills?.length ?? 0} skill(s), needs >= 3`);
    if ((c.workPreferences ?? []).length < 1) warn(key, "approved career has no work-preference profile");
    if ((c.careerPriorities ?? []).length < 1) warn(key, "approved career has no career-priority profile");
    if ((c.educationRoutes ?? []).length < 1) warn(key, "approved career has no education route");
    if ((c.industryKeys ?? []).length < 1) warn(key, "approved career has no industry");
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const errors = problems.filter((p) => p.level === "error");
const warnings = problems.filter((p) => p.level === "warning");

console.log(`\nMilestone 4 career data validation`);
console.log(`Careers checked: ${ALL_CAREERS.length}`);
console.log(`Errors: ${errors.length}  Warnings: ${warnings.length}\n`);

for (const p of errors) {
  console.log(`  ERROR   [${p.careerKey}] ${p.message}`);
}
for (const p of warnings) {
  console.log(`  WARNING [${p.careerKey}] ${p.message}`);
}

if (errors.length > 0) {
  console.log(`\nvalidate-career-data: FAILED (${errors.length} error(s)).\n`);
  process.exit(1);
} else {
  console.log(`\nvalidate-career-data: PASSED${warnings.length > 0 ? ` with ${warnings.length} warning(s)` : ""}.\n`);
  process.exit(0);
}
