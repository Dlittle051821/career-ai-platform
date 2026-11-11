import { beforeEach, describe, expect, it, vi } from "vitest";
import { findTextLimitError, MAX_EDUCATION_RECORDS, MAX_EXPERIENCE_RECORDS, PROFILE_TEXT_LIMITS } from "./input-limits";

/**
 * CC-24 — the profile save Server Actions accepted text of any length and
 * any number of education/experience rows when called directly (the
 * database has no length constraints on these columns). These tests drive
 * the real actions with only Supabase, analytics and Next's cache
 * replaced, and assert that an oversized request is refused BEFORE any
 * delete/insert/upsert reaches the database.
 */

describe("findTextLimitError", () => {
  it("passes values at the limit and null/undefined", () => {
    expect(findTextLimitError([["city", "x".repeat(PROFILE_TEXT_LIMITS.city)], ["state", null], ["country", undefined]])).toBeNull();
  });
  it("measures after trimming, like the stored value", () => {
    expect(findTextLimitError([["city", `  ${"x".repeat(PROFILE_TEXT_LIMITS.city)}  `]])).toBeNull();
  });
  it("names the field and the limit for the first value that is too long", () => {
    expect(findTextLimitError([["city", "ok"], ["dreamReason", "x".repeat(PROFILE_TEXT_LIMITS.dreamReason + 1)]])).toBe(
      `Why this career can be at most ${PROFILE_TEXT_LIMITS.dreamReason} characters.`
    );
  });
  it("rejects a non-string value", () => {
    expect(findTextLimitError([["city", { evil: true }]])).toMatch(/isn't valid/);
  });
});

const db = vi.hoisted(() => ({ writes: [] as string[] }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "student-fixture" } } }) },
    rpc: async () => ({ data: null, error: null }),
    from: (table: string) => ({
      upsert: async () => {
        db.writes.push(`upsert:${table}`);
        return { error: null };
      },
      delete: () => ({
        eq: async () => {
          db.writes.push(`delete:${table}`);
          return { error: null };
        },
      }),
      insert: async () => {
        db.writes.push(`insert:${table}`);
        return { error: null };
      },
      update: () => ({ eq: async () => ({ error: null }) }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
    }),
  }),
}));
vi.mock("@/lib/supabase/student-profile", () => ({ getStudentProfileSnapshot: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/supabase/analytics/track", () => ({ trackEvent: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveAboutYou, saveCareerGoals, saveEducation, saveExperience, saveInterests, saveStudyPreferences } from "@/lib/supabase/student-profile-actions";

const aboutYou = { dateOfBirth: null, gender: null, city: "Bhubaneswar", state: "Odisha", country: "India", preferredLanguage: "Odia", currentStatus: null };
const edu = {
  educationLevel: "class_12",
  institutionName: "Fictional School",
  boardOrUniversity: null,
  fieldOfStudy: null,
  specialization: null,
  startYear: null,
  endYear: null,
  status: "completed",
  scoreType: null,
  scoreValue: null,
  backlogs: null,
};
const exp = { type: "internship", title: "Fictional internship", organization: null, description: null, year: null };
const goals = { clarity: null, dreamJobTitle: null, dreamIndustry: null, dreamReason: null, careerIdeas: [], lifeGoalsText: null };

describe("profile save actions enforce limits before writing", () => {
  beforeEach(() => {
    db.writes = [];
  });

  it("About You: a normal save still writes", async () => {
    const r = await saveAboutYou(aboutYou);
    expect(r.success).toBe(true);
    expect(db.writes).toContain("upsert:student_profiles");
  });

  it("About You: an over-long city is refused with no write", async () => {
    const r = await saveAboutYou({ ...aboutYou, city: "x".repeat(20000) });
    expect(r).toEqual({ success: false, error: `City can be at most ${PROFILE_TEXT_LIMITS.city} characters.` });
    expect(db.writes).toEqual([]);
  });

  it("Education: too many rows are refused before the delete", async () => {
    const r = await saveEducation(Array.from({ length: MAX_EDUCATION_RECORDS + 1 }, () => edu));
    expect(r.success).toBe(false);
    expect(r.error).toContain(`up to ${MAX_EDUCATION_RECORDS}`);
    expect(db.writes).toEqual([]);
  });

  it("Education: an over-long institution name is refused before the delete", async () => {
    const r = await saveEducation([{ ...edu, institutionName: "x".repeat(5000) }]);
    expect(r.success).toBe(false);
    expect(db.writes).toEqual([]);
  });

  it("Education: the maximum number of valid rows still saves", async () => {
    const r = await saveEducation(Array.from({ length: MAX_EDUCATION_RECORDS }, () => edu));
    expect(r.success).toBe(true);
    expect(db.writes.slice(0, 2)).toEqual(["delete:student_education", "insert:student_education"]);
  });

  it("Interests: an over-long 'other' text is refused before the delete", async () => {
    const r = await saveInterests([{ interestKey: "other", strength: null }], "x".repeat(5000));
    expect(r.success).toBe(false);
    expect(db.writes).toEqual([]);
  });

  it("Career goals: an over-long life-goals text or idea is refused", async () => {
    expect((await saveCareerGoals({ ...goals, lifeGoalsText: "x".repeat(PROFILE_TEXT_LIMITS.lifeGoalsText + 1) })).success).toBe(false);
    expect((await saveCareerGoals({ ...goals, careerIdeas: ["x".repeat(500)] })).success).toBe(false);
    expect(db.writes).toEqual([]);
  });

  it("Study preferences: an oversized destination list is refused", async () => {
    const r = await saveStudyPreferences({
      studyFurther: null,
      studyAbroad: null,
      preferredStudyDestinations: Array.from({ length: 5000 }, () => "germany"),
      preferredWorkDestinations: [],
      relocateWithinIndia: null,
      relocateInternational: null,
    });
    expect(r.success).toBe(false);
    expect(db.writes).toEqual([]);
  });

  it("Experience: too many rows or an over-long description are refused before the delete", async () => {
    expect((await saveExperience(Array.from({ length: MAX_EXPERIENCE_RECORDS + 1 }, () => exp))).success).toBe(false);
    expect((await saveExperience([{ ...exp, description: "x".repeat(PROFILE_TEXT_LIMITS.experienceDescription + 1) }])).success).toBe(false);
    expect(db.writes).toEqual([]);
  });
});
