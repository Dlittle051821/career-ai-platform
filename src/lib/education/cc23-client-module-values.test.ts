import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_COMPARE_COURSES } from "@/lib/education/compare-limits";

/**
 * CC-23 — server code that imports a *value* (not a component) from a
 * "use client" module receives a client reference, not the value. That made
 * /courses/compare discard every selected course. Guard the whole tree.
 */
const SRC = join(process.cwd(), "src");
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const isClient = (s: string) => /^\s*["']use client["']/.test(s);

describe("CC-23: values from client modules", () => {
  it("the compare limit is the real number on the server", () => {
    expect(MAX_COMPARE_COURSES).toBe(4);
    expect(["a", "b", "c"].slice(0, MAX_COMPARE_COURSES)).toEqual(["a", "b", "c"]);
  });

  it("the compare page takes its limit from the shared module, not the client tray", () => {
    const page = readFileSync(join(SRC, "app/(site)/courses/compare/page.tsx"), "utf8");
    expect(page).toContain('import { MAX_COMPARE_COURSES } from "@/lib/education/compare-limits";');
    expect(page).not.toContain('from "@/components/sections/education/CompareTray"');
  });

  it("no server module imports an UPPER_CASE constant from a \"use client\" module", () => {
    const files = walk(SRC);
    const clientConsts = new Map<string, string[]>();
    for (const f of files) {
      const s = readFileSync(f, "utf8");
      if (!isClient(s)) continue;
      const names = [...s.matchAll(/export const ([A-Z][A-Z0-9_]+)\s*=/g)].map((m) => m[1]);
      if (names.length) clientConsts.set("@/" + relative(SRC, f).replace(/\.(ts|tsx)$/, ""), names);
    }
    const offenders: string[] = [];
    for (const f of files) {
      const s = readFileSync(f, "utf8");
      if (isClient(s)) continue;
      for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
        const consts = clientConsts.get(m[2]);
        if (!consts) continue;
        const imported = m[1].split(",").map((x) => x.trim().split(/\s+as\s+/)[0]);
        for (const n of imported) if (consts.includes(n)) offenders.push(`${relative(SRC, f)} imports ${n} from ${m[2]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
