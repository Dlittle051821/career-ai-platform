import type { StudentProfileSnapshot } from "@/types/student-profile";
import { cleanText, looksLikeInstruction, scrubPii } from "@/lib/ai/text-safety";
import { LABELS, RATING, label } from "./labels";

/**
 * NW09 — data minimisation. Turns a full StudentProfileSnapshot into the
 * SMALLEST structured profile the analysis needs. This is the only shape
 * that is ever sent to a provider.
 *
 * NEVER included: name, e-mail, phone, date of birth (only an age group is
 * derived), gender, city/state, institution or board names, exact marks,
 * experience organisations or descriptions, account ids. Protected
 * attributes are not sent and cannot be used for ranking.
 * Free text the student typed (goal title, reason, ideas) is PII-scrubbed,
 * stripped of control characters, length-capped, and passed only as quoted
 * data; text that tries to address the model is flagged for the counsellor.
 */
export interface AiStudentProfile {
  profileRef: "P1";
  stage: string | null;
  ageGroup: "under_18" | "18_plus" | "unknown";
  education: Array<{ level: string; field: string | null; status: string }>;
  subjectStrengths: Array<{ subject: string; rating: string }>;
  interests: Array<{ interest: string; strength: string | null }>;
  skills: Array<{ skill: string; level: string }>;
  workPreferences: Array<{ statement: string; response: string }>;
  careerPriorities: Array<{ priority: string; response: string }>;
  goals: { clarity: string | null; aspiredRole: string | null; aspiredIndustry: string | null; careerIdeas: string[]; statedReason: string | null } | null;
  study: { studyFurther: string | null; studyAbroad: string | null; preferredDestinations: string[]; relocateWithinIndia: string | null; relocateInternational: string | null } | null;
  budget: { band: string | null; fundingSource: string | null; openToLoan: string | null } | null;
  experience: Array<{ type: string; title: string; year: number | null }>;
}

export interface MinimisedProfile {
  profile: AiStudentProfile;
  isMinor: boolean;
  /** True when any free-text field looked like instructions to an AI. */
  instructionLikeText: boolean;
}

export function ageGroupFor(dateOfBirth: string | null, today: Date): AiStudentProfile["ageGroup"] {
  if (!dateOfBirth) return "unknown";
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return "unknown";
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const m = today.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < dob.getUTCDate())) age -= 1;
  if (age < 0 || age > 120) return "unknown";
  return age < 18 ? "under_18" : "18_plus";
}

export function minimiseProfile(snapshot: StudentProfileSnapshot, today: Date): MinimisedProfile {
  let flagged = false;
  const free = (value: string | null | undefined, max: number): string | null => {
    const v = cleanText(scrubPii(value ?? ""), max);
    if (!v) return null;
    if (looksLikeInstruction(v)) flagged = true;
    return v;
  };
  const p = snapshot.profile;
  const ageGroup = ageGroupFor(p.dateOfBirth, today);
  // School-stage students are treated as minors when the date of birth is missing.
  const schoolStage = p.currentStatus === "school_10" || p.currentStatus === "school_12";
  const isMinor = ageGroup === "under_18" || (ageGroup === "unknown" && schoolStage);

  const g = snapshot.careerGoals;
  const s = snapshot.studyPreferences;
  const f = snapshot.fundingPreferences;
  const profile: AiStudentProfile = {
    profileRef: "P1",
    stage: label(LABELS.status, p.currentStatus),
    ageGroup: isMinor && ageGroup === "unknown" ? "under_18" : ageGroup,
    education: snapshot.education.slice(0, 6).map((e) => ({
      level: label(LABELS.educationLevel, e.educationLevel) ?? "Other",
      field: label(LABELS.field, e.fieldOfStudy) ?? free(e.fieldOfStudy, 60),
      status: e.status,
    })),
    subjectStrengths: snapshot.subjectStrengths
      .map((x) => ({ subject: label(LABELS.subject, x.subjectKey), rating: RATING.subject[x.rating] ?? String(x.rating) }))
      .filter((x): x is { subject: string; rating: string } => Boolean(x.subject))
      .slice(0, 20),
    interests: snapshot.interests
      .map((x) => ({ interest: label(LABELS.interest, x.interestKey) ?? free(x.otherText, 60), strength: x.strength ? (RATING.interest[x.strength] ?? null) : null }))
      .filter((x): x is { interest: string; strength: string | null } => Boolean(x.interest))
      .slice(0, 20),
    skills: snapshot.skills
      .map((x) => ({ skill: label(LABELS.skill, x.skillKey), level: label(LABELS.skillLevel, x.level) ?? x.level }))
      .filter((x): x is { skill: string; level: string } => Boolean(x.skill))
      .slice(0, 25),
    workPreferences: snapshot.workPreferences
      .map((x) => ({ statement: label(LABELS.workPreference, x.preferenceKey), response: RATING.agreement[x.rating] ?? String(x.rating) }))
      .filter((x): x is { statement: string; response: string } => Boolean(x.statement))
      .slice(0, 20),
    careerPriorities: snapshot.careerPriorities
      .map((x) => ({ priority: label(LABELS.priority, x.priorityKey), response: RATING.agreement[x.rating] ?? String(x.rating) }))
      .filter((x): x is { priority: string; response: string } => Boolean(x.priority))
      .slice(0, 20),
    goals: g
      ? {
          clarity: label(LABELS.clarity, g.clarity),
          aspiredRole: free(g.dreamJobTitle, 80),
          aspiredIndustry: free(g.dreamIndustry, 80),
          careerIdeas: g.careerIdeas.map((i) => free(i, 60)).filter((i): i is string => Boolean(i)).slice(0, 5),
          statedReason: free(g.dreamReason, 300),
        }
      : null,
    study: s
      ? {
          studyFurther: label(LABELS.yesNo, s.studyFurther),
          studyAbroad: label(LABELS.yesNo, s.studyAbroad),
          preferredDestinations: s.preferredStudyDestinations.map((d) => label(LABELS.country, d)).filter((d): d is string => Boolean(d)).slice(0, 6),
          relocateWithinIndia: label(LABELS.yesNo, s.relocateWithinIndia),
          relocateInternational: label(LABELS.yesNo, s.relocateInternational),
        }
      : null,
    budget: f ? { band: label(LABELS.budget, f.budgetBand), fundingSource: label(LABELS.funding, f.fundingSource), openToLoan: label(LABELS.yesNo, f.loanOpenness) } : null,
    experience: snapshot.experience
      .slice(0, 8)
      .map((x) => ({ type: label(LABELS.experienceType, x.type) ?? "Other", title: free(x.title, 80) ?? "", year: x.year }))
      .filter((x) => x.title),
  };
  return { profile, isMinor, instructionLikeText: flagged };
}
