import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CC-26 — regression for CC-25 E9: /applications/<unknown or someone else's id>
 * answered HTTP 200 with the not-found card (a soft 404). Cause:
 * src/app/(site)/applications/loading.tsx wrapped the [id] child segment in a
 * Suspense boundary, so the page's notFound() ran after the 200 was sent.
 * Fix (same pattern as CC-24 universities/courses): the list skeleton is the
 * list page's own Suspense fallback, and [id]/layout.tsx checks ownership
 * before the [id]/loading.tsx boundary.
 */

const io = vi.hoisted(() => ({
  user: null as { id: string } | null,
  application: null as { id: string } | null,
  lookups: 0,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
vi.mock("@/lib/supabase/profile", () => ({ getCurrentUser: async () => io.user }));
vi.mock("@/lib/supabase/education/application-lookup-cached", () => ({
  getMyApplicationByIdCached: async () => {
    io.lookups += 1;
    return io.application;
  },
}));

import ApplicationDetailLayout from "@/app/(site)/applications/[id]/layout";

const APP = path.resolve(import.meta.dirname, "../../app/(site)");
const read = (p: string) => readFileSync(path.join(APP, p), "utf8");

beforeEach(() => {
  io.user = { id: "student-fixture" };
  io.application = null;
  io.lookups = 0;
});

describe("/applications/[id] answers a genuine 404 (CC-26)", () => {
  it("no loading.tsx in a parent segment wraps the detail route", () => {
    expect(existsSync(path.join(APP, "applications", "loading.tsx"))).toBe(false);
    expect(existsSync(path.join(APP, "loading.tsx"))).toBe(false);
  });

  it("the detail route keeps its own skeleton, guarded by a layout that runs first", () => {
    expect(existsSync(path.join(APP, "applications", "[id]", "loading.tsx"))).toBe(true);
    const layout = read("applications/[id]/layout.tsx");
    expect(layout).toContain("if (!application) notFound();");
    expect(layout).toMatch(/getMyApplicationByIdCached\(id\)/);
    expect(layout).toMatch(/if \(!user\) redirect\(`\/login\?next=\/applications\/\$\{id\}`\);/);
  });

  it("an unknown or foreign application id -> notFound() from the layout", async () => {
    io.application = null;
    await expect(ApplicationDetailLayout({ children: "page", params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000000" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(io.lookups).toBe(1);
  });

  it("signed out -> login redirect, before any lookup", async () => {
    io.user = null;
    await expect(ApplicationDetailLayout({ children: "page", params: Promise.resolve({ id: "abc" }) })).rejects.toThrow("NEXT_REDIRECT /login?next=/applications/abc");
    expect(io.lookups).toBe(0);
  });

  it("the student's own application renders the page", async () => {
    io.application = { id: "abc" };
    await expect(ApplicationDetailLayout({ children: "page", params: Promise.resolve({ id: "abc" }) })).resolves.toBe("page");
  });

  it("the page uses the same cached lookup (one database call per request) and still guards itself", () => {
    const page = read("applications/[id]/page.tsx");
    expect(page).toContain("const application = await getMyApplicationByIdCached(id);");
    expect(page).toContain("if (!application) notFound();");
    expect(page).not.toMatch(/await getMyApplicationById\(id\)/);
  });

  it("the /applications list keeps its skeleton as its own Suspense fallback", () => {
    const list = read("applications/page.tsx");
    expect(list).toContain('import ApplicationsLoading from "./list-skeleton";');
    expect(list).toContain("<Suspense fallback={<ApplicationsLoading />}>");
    const skeleton = read("applications/list-skeleton.tsx");
    expect(skeleton).toContain('role="status" aria-live="polite"');
    expect(skeleton).toContain("Loading your applications…");
  });
});
