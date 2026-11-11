import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CC-24 — regression for CC-23 D3/E3: unknown or unpublished career,
 * university and course URLs answered HTTP 200 with a "couldn't find"
 * card (a soft 404), because the lookups returned null both for "no such
 * record" and for "the database failed". The lookups now return a
 * three-way result and the pages call notFound() only for a missing record.
 */

type Result = { data: unknown; error: unknown };
const db = vi.hoisted(() => ({ queue: [] as Result[] }));

function chain(): Record<string, unknown> {
  const next = () => db.queue.shift() ?? { data: null, error: null };
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order", "limit", "or", "not", "is"]) c[m] = () => c;
  c.maybeSingle = async () => next();
  c.single = async () => next();
  c.then = (resolve: (r: Result) => unknown) => resolve(next());
  return c;
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => chain(), rpc: async () => ({ data: null, error: null }) }) }));

import { lookupCareerBySlug, getCareerBySlug } from "@/lib/supabase/careers";
import { lookupPublicUniversityBySlug, getPublicUniversityBySlug } from "@/lib/supabase/education/universities";
import { lookupPublicCourseBySlugPair, getPublicCourseBySlugPair } from "@/lib/supabase/education/courses";

const dbError = { data: null, error: { message: "connection refused", code: "08006" } };
const none = { data: null, error: null };

describe("detail lookups tell 'missing' apart from 'failed'", () => {
  beforeEach(() => {
    db.queue = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("career: no row -> not_found; query error -> unavailable", async () => {
    db.queue = [none];
    await expect(lookupCareerBySlug("no-such-career")).resolves.toEqual({ status: "not_found" });
    db.queue = [dbError];
    await expect(lookupCareerBySlug("anything")).resolves.toEqual({ status: "unavailable" });
  });

  it("university: no published row -> not_found; query error -> unavailable", async () => {
    db.queue = [none];
    await expect(lookupPublicUniversityBySlug("fictional-draft-university")).resolves.toEqual({ status: "not_found" });
    db.queue = [dbError];
    await expect(lookupPublicUniversityBySlug("anything")).resolves.toEqual({ status: "unavailable" });
  });

  it("course: unknown university or unknown course -> not_found; either query failing -> unavailable", async () => {
    db.queue = [none];
    await expect(lookupPublicCourseBySlugPair("nope", "nope")).resolves.toEqual({ status: "not_found" });
    db.queue = [{ data: { id: "u1", name: "Fictional U", slug: "fictional-u", city: null, country_id: "c1" }, error: null }, none];
    await expect(lookupPublicCourseBySlugPair("fictional-u", "unpublished-course")).resolves.toEqual({ status: "not_found" });
    db.queue = [dbError];
    await expect(lookupPublicCourseBySlugPair("x", "y")).resolves.toEqual({ status: "unavailable" });
    db.queue = [{ data: { id: "u1", name: "Fictional U", slug: "fictional-u", city: null, country_id: "c1" }, error: null }, dbError];
    await expect(lookupPublicCourseBySlugPair("fictional-u", "y")).resolves.toEqual({ status: "unavailable" });
  });

  it("the original null-returning functions keep their contract for other callers", async () => {
    db.queue = [none];
    await expect(getCareerBySlug("x")).resolves.toBeNull();
    db.queue = [dbError];
    await expect(getPublicUniversityBySlug("x")).resolves.toBeNull();
    db.queue = [none];
    await expect(getPublicCourseBySlugPair("x", "y")).resolves.toBeNull();
  });
});

const APP = path.resolve(import.meta.dirname, "../../app/(site)");
// `notFoundDir` is where the not-found card lives. Routes with a
// loading.tsx skeleton check existence in their own layout.tsx (which
// renders before the Suspense boundary, so the status can still be 404);
// a notFound() thrown in a layout is caught one segment up.
const routes = [
  { dir: "careers/[slug]", lookup: "careerLookup", noun: "career", notFoundDir: "careers/[slug]", layoutGuard: false },
  { dir: "universities/[slug]", lookup: "universityLookup", noun: "university", notFoundDir: "universities", layoutGuard: true },
  { dir: "courses/[universitySlug]/[courseSlug]", lookup: "courseLookup", noun: "course", notFoundDir: "courses/[universitySlug]", layoutGuard: true },
];

describe.each(routes)("$dir answers a genuine 404 for a missing record", ({ dir, lookup, noun, notFoundDir, layoutGuard }) => {
  const page = readFileSync(path.join(APP, dir, "page.tsx"), "utf8");

  it("calls notFound() for not_found, before rendering anything else", () => {
    expect(page).toContain(`if (${lookup}.status === "not_found") notFound();`);
    expect(page).toContain('import { notFound } from "next/navigation";');
  });

  it("does not claim a record is missing when the lookup failed", () => {
    expect(page).toContain(`if (${lookup}.status === "unavailable")`);
    expect(page).toContain(`kind="unavailable" noun="${noun}"`);
    expect(page).not.toMatch(/We couldn&apos;t find that/);
  });

  it("has a not-found.tsx with the same friendly card", () => {
    const nf = path.join(APP, notFoundDir, "not-found.tsx");
    expect(existsSync(nf)).toBe(true);
    expect(readFileSync(nf, "utf8")).toContain(`kind="not_found" noun="${noun}"`);
  });

  it("has no loading.tsx in any parent segment (it would wrap this route and force HTTP 200)", () => {
    const parts = dir.split("/");
    for (let i = 1; i < parts.length; i++) {
      const ancestor = parts.slice(0, i).join("/");
      expect(existsSync(path.join(APP, ancestor, "loading.tsx")), `${ancestor}/loading.tsx`).toBe(false);
    }
  });

  it("checks existence before any loading.tsx skeleton can send a 200", () => {
    const hasLoading = existsSync(path.join(APP, dir, "loading.tsx"));
    expect(layoutGuard).toBe(hasLoading);
    if (layoutGuard) {
      const layout = readFileSync(path.join(APP, dir, "layout.tsx"), "utf8");
      expect(layout).toContain('if (lookup.status === "not_found") notFound();');
      expect(layout).toMatch(/Cached\(/);
    }
  });
});
