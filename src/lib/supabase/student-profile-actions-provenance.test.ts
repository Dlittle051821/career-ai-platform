import { beforeEach, describe, expect, it, vi } from "vitest";

// NW05.3 — a sixth, equally narrow exception to the "src/lib/supabase/ is
// untested here" convention (see vitest.config.mts's own running
// commentary on this pattern): the provenance-downgrade call this
// milestone adds to every one of student-profile-actions.ts's 11 save
// functions is STATEFUL ORCHESTRATION (an RPC call layered on top of an
// existing Supabase write, with a safe-fallback-on-error requirement) that
// cannot be exercised as a pure function. This file mocks the same kind
// of I/O boundaries (createClient, plus this module's own
// getStudentProfileSnapshot/trackEvent/next-cache dependencies) behind a
// hand-rolled in-memory Supabase fake, same convention as refunds.test.ts/
// applications.test.ts/application-documents.test.ts above it.
//
// What this file is verifying, concretely: every section-save function
// calls the PROPOSED `student_mark_section_self_entered` RPC with EXACTLY
// its own real section key (never another section's, and never a
// client-suppliable value — the key is a hardcoded literal at each call
// site, not derived from user input), and that an RPC failure (expected in
// every environment until supabase/migrations-proposed/
// NW05_student_mark_section_self_entered.sql is reviewed and applied) never
// fails the student's actual save.

vi.mock("./server", () => ({ createClient: vi.fn() }));
vi.mock("./student-profile", () => ({ getStudentProfileSnapshot: vi.fn().mockResolvedValue(null) }));
vi.mock("./analytics/track", () => ({ trackEvent: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createClient } from "./server";
import {
  saveAboutYou,
  saveEducation,
  saveSubjectStrengths,
  saveInterests,
  saveSkills,
  saveWorkPreferences,
  saveCareerPriorities,
  saveCareerGoals,
  saveStudyPreferences,
  saveFundingPreferences,
  saveExperience,
} from "./student-profile-actions";

function makeFakeSupabase(rpcError: { message: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: rpcError });
  const from = () => ({
    upsert: () => Promise.resolve({ error: null }),
    delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    insert: () => Promise.resolve({ error: null }),
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
  });
  return {
    client: {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "student-1" } } }) },
      from,
      rpc,
    },
    rpc,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("student-profile-actions.ts — NW05.3 provenance-downgrade wiring", () => {
  // One case per save function — each real section key, per
  // src/types/profile-provenance.ts's PROFILE_SECTION_KEYS.
  const cases: Array<{ name: string; sectionKey: string; run: (client: unknown) => Promise<{ success: boolean }> }> = [
    {
      name: "saveAboutYou",
      sectionKey: "about_you",
      run: async () =>
        saveAboutYou({ dateOfBirth: null, gender: null, city: null, state: null, country: "India", preferredLanguage: null, currentStatus: null }),
    },
    { name: "saveEducation", sectionKey: "education", run: async () => saveEducation([]) },
    { name: "saveSubjectStrengths", sectionKey: "subject_strengths", run: async () => saveSubjectStrengths([]) },
    { name: "saveInterests", sectionKey: "interests", run: async () => saveInterests([], null) },
    { name: "saveSkills", sectionKey: "skills", run: async () => saveSkills([]) },
    { name: "saveWorkPreferences", sectionKey: "work_preferences", run: async () => saveWorkPreferences([]) },
    { name: "saveCareerPriorities", sectionKey: "career_priorities", run: async () => saveCareerPriorities([]) },
    {
      name: "saveCareerGoals",
      sectionKey: "career_goals",
      run: async () => saveCareerGoals({ clarity: null, dreamJobTitle: null, dreamIndustry: null, dreamReason: null, careerIdeas: [], lifeGoalsText: null }),
    },
    {
      name: "saveStudyPreferences",
      sectionKey: "study_location",
      run: async () =>
        saveStudyPreferences({
          studyFurther: null,
          studyAbroad: null,
          preferredStudyDestinations: [],
          preferredWorkDestinations: [],
          relocateWithinIndia: null,
          relocateInternational: null,
        }),
    },
    {
      name: "saveFundingPreferences",
      sectionKey: "budget_funding",
      run: async () => saveFundingPreferences({ budgetBand: null, fundingSource: null, loanOpenness: null }),
    },
    { name: "saveExperience", sectionKey: "experience", run: async () => saveExperience([]) },
  ];

  for (const { name, sectionKey, run } of cases) {
    it(`${name}() calls the downgrade RPC with its own section key ("${sectionKey}") after a successful save`, async () => {
      const { client, rpc } = makeFakeSupabase();
      vi.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>);

      const result = await run(client);

      expect(result.success).toBe(true);
      expect(rpc).toHaveBeenCalledWith("student_mark_section_self_entered", { p_section_key: sectionKey });
      // Never any other section key, and never a provenance value passed —
      // the RPC call site only ever sends the one hardcoded section key.
      expect(rpc).toHaveBeenCalledTimes(1);
    });
  }

  it("saveAboutYou() still succeeds when the downgrade RPC errors (the migration is not yet applied in this/any environment)", async () => {
    const { client } = makeFakeSupabase({ message: "function public.student_mark_section_self_entered(text) does not exist" });
    vi.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await saveAboutYou({
      dateOfBirth: null,
      gender: null,
      city: null,
      state: null,
      country: "India",
      preferredLanguage: null,
      currentStatus: null,
    });

    expect(result.success).toBe(true);
  });

  it("saveEducation() still succeeds when the downgrade RPC errors", async () => {
    const { client } = makeFakeSupabase({ message: "function public.student_mark_section_self_entered(text) does not exist" });
    vi.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await saveEducation([]);

    expect(result.success).toBe(true);
  });

  it("saveEducation() still succeeds when the downgrade RPC throws outright", async () => {
    const client = {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "student-1" } } }) },
      from: () => ({
        upsert: () => Promise.resolve({ error: null }),
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        insert: () => Promise.resolve({ error: null }),
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
      }),
      rpc: vi.fn().mockRejectedValue(new Error("network error")),
    };
    vi.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await saveEducation([]);

    expect(result.success).toBe(true);
  });
});
