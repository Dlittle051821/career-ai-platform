import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * University Discovery V3 — the access rule is enforced in the data layer.
 * With no access, every university and course reader answers "nothing" and
 * does not issue a single database query.
 */
const state = vi.hoisted(() => ({ directory: false, courses: false, fromCalls: 0 }));

vi.mock("@/lib/supabase/education/university-access", () => ({
  hasUniversityDirectoryAccess: async () => state.directory,
  hasInternalCourseAccess: async () => state.courses,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      state.fromCalls += 1;
      throw new Error("the database must not be queried without access");
    },
  }),
}));

import * as universities from "@/lib/supabase/education/universities";
import * as courses from "@/lib/supabase/education/courses";

describe("University Discovery V3 — data-layer access", () => {
  beforeEach(() => {
    state.directory = false;
    state.courses = false;
    state.fromCalls = 0;
  });

  it("a visitor without directory access reads no university data", async () => {
    await expect(universities.searchUniversities({ q: "aachen" })).resolves.toMatchObject({ items: [], total: 0 });
    await expect(universities.lookupPublicUniversityBySlug("rwth-aachen-university")).resolves.toEqual({ status: "not_found" });
    await expect(universities.getPublicUniversityBySlug("rwth-aachen-university")).resolves.toBeNull();
    await expect(universities.getUniversitiesByIds(["u1"])).resolves.toEqual([]);
    await expect(universities.getPublishedUniversitySlugsForSitemap()).resolves.toEqual([]);
    await expect(universities.listPublicCampusesForUniversity("u1")).resolves.toEqual([]);
    await expect(universities.listPublicScholarshipsForUniversity("u1")).resolves.toEqual([]);
    expect(state.fromCalls).toBe(0);
  });

  it("a Verified student (directory access, no course access) still reads no course data", async () => {
    state.directory = true;
    await expect(courses.searchCourses({ q: "engineering" })).resolves.toMatchObject({ items: [], total: 0 });
    await expect(courses.lookupPublicCourseBySlugPair("rwth-aachen-university", "any")).resolves.toEqual({ status: "not_found" });
    await expect(courses.getPublicCourseBySlugPair("rwth-aachen-university", "any")).resolves.toBeNull();
    await expect(courses.getCoursesByIds(["c1"])).resolves.toEqual([]);
    await expect(courses.getPublishedCourseSlugPairsForSitemap()).resolves.toEqual([]);
    await expect(courses.listPublicIntakesForCourse("c1")).resolves.toEqual([]);
    await expect(courses.listPublicTuitionFeesForCourse("c1")).resolves.toEqual([]);
    await expect(courses.listPublicAdmissionRequirementsForCourse("c1")).resolves.toEqual([]);
    await expect(courses.listPublicScholarshipsForCourse("c1")).resolves.toEqual([]);
    expect(state.fromCalls).toBe(0);
  });

  it("every exported reader in both modules starts with the access check", () => {
    const check = (file: string, guard: string) => {
      const source = readFileSync(path.join(process.cwd(), "src/lib/supabase/education", file), "utf8");
      const readers = [...source.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]);
      expect(readers.length).toBeGreaterThan(5);
      for (const name of readers) {
        const body = source.slice(source.indexOf(`export async function ${name}(`));
        const end = body.indexOf("\nexport ", 10);
        const own = end === -1 ? body : body.slice(0, end);
        // The two null-returning wrappers delegate to their guarded lookup.
        const delegates = /return lookupValue\(await lookupPublic/.test(own);
        expect(own.includes(`await ${guard}()`) || delegates, `${file}: ${name} must check access`).toBe(true);
      }
    };
    check("universities.ts", "hasUniversityDirectoryAccess");
    check("courses.ts", "hasInternalCourseAccess");
  });
});
