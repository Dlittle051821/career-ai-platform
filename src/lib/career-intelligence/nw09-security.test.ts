
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasPermission, ROLE_PERMISSIONS } from "@/lib/admin/permissions";

/**
 * NW09 — Static security guards
 *
 * Verifies that:
 * - API secrets remain server-side.
 * - Client components cannot directly access AI providers.
 * - Only authorised roles can generate AI analysis.
 * - Database migrations maintain their security protections.
 *
 * Compatible with Windows, macOS and Linux.
 */

const ROOT = process.cwd();

const read = (rel: string): string =>
  readFileSync(path.join(ROOT, rel), "utf8");

/**
 * Normalise filesystem paths to forward slashes.
 *
 * Windows uses backslashes, while Unix-based systems use
 * forward slashes. This ensures consistent security tests
 * on Windows development and Linux CI/Vercel environments.
 */
const normalizePath = (filePath: string): string =>
  filePath.replace(/\\/g, "/");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const filePath = path.join(dir, name);

    if (statSync(filePath).isDirectory()) {
      walk(filePath, out);
    } else if (
      /\.(ts|tsx)$/.test(name) &&
      !/\.test\.tsx?$/.test(name)
    ) {
      out.push(filePath);
    }
  }

  return out;
}

const SOURCES = walk(path.join(ROOT, "src")).map((filePath) => ({
  rel: normalizePath(path.relative(ROOT, filePath)),
  text: readFileSync(filePath, "utf8"),
}));

// ============================================================
// 1. SERVER-SIDE SECRET PROTECTION
// ============================================================

describe("secrets never reach a browser", () => {
  it("no NEXT_PUBLIC_ AI variable exists anywhere", () => {
    const bad = SOURCES.filter((source) =>
      /NEXT_PUBLIC_[A-Z_]*(OPENAI|GEMINI|AI_PROVIDER|API_KEY_AI|AI_)/.test(
        source.text
      )
    ).map((source) => source.rel);

    expect(bad).toEqual([]);

    expect(read(".env.example")).not.toMatch(
      /NEXT_PUBLIC_(OPENAI|GEMINI|AI_)/
    );
  });

  it("API keys are read in exactly one server-only module", () => {
    const readers = SOURCES.filter((source) =>
      /process\.env\.(OPENAI_API_KEY|GEMINI_API_KEY)/.test(source.text)
    ).map((source) => source.rel);

    expect(readers).toEqual(["src/lib/ai/get-provider.ts"]);

    expect(read("src/lib/ai/get-provider.ts")).toMatch(
      /^import "server-only";/
    );
  });

  it(
    "no client component imports the AI layer, provider SDKs, service or gateway",
    () => {
      const clientFiles = SOURCES.filter((source) =>
        /^\s*["']use client["']/.test(source.text)
      );

      expect(clientFiles.length).toBeGreaterThan(0);

      const bad = clientFiles.filter((source) =>
        /from "(@\/lib\/ai\/|openai|@google\/genai|@\/lib\/career-intelligence\/(service|pipeline|prompt)|@\/lib\/supabase\/admin\/career-intelligence)/.test(
          source.text
        )
      ).map((source) => source.rel);

      expect(bad).toEqual([]);
    }
  );

  it("the .env.example ships no key values", () => {
    const envExample = read(".env.example");

    expect(envExample).toMatch(/^OPENAI_API_KEY=$/m);
    expect(envExample).toMatch(/^GEMINI_API_KEY=$/m);
    expect(envExample).toMatch(/^AI_OPENAI_APPROVED=$/m);
  });

  it("requests to OpenAI are stateless", () => {
    expect(read("src/lib/ai/providers/openai.ts")).toMatch(
      /store: false/
    );
  });

  it("AI errors are logged without request content", () => {
    const gateway = read(
      "src/lib/supabase/admin/career-intelligence.ts"
    );

    expect(gateway).not.toMatch(
      /console\.(log|error)\([^)]*(snapshot|report|content|prompt)/
    );
  });
});

// ============================================================
// 2. AI AUTHORISATION AND ROLE SECURITY
// ============================================================

describe("who may request an analysis", () => {
  it(
    "admins and counsellors only — never finance, content editors or analysts",
    () => {
      for (const role of [
        "super_admin",
        "admin",
        "counsellor",
      ] as const) {
        expect(
          hasPermission(role, "career-intelligence:generate")
        ).toBe(true);
      }

      for (const role of [
        "finance",
        "content_editor",
        "analyst",
      ] as const) {
        expect(
          hasPermission(role, "career-intelligence:generate")
        ).toBe(false);
      }

      expect(
        hasPermission(null, "career-intelligence:generate")
      ).toBe(false);

      for (const role of Object.keys(ROLE_PERMISSIONS) as
        (keyof typeof ROLE_PERMISSIONS)[]) {
        if (hasPermission(role, "career-intelligence:generate")) {
          expect(
            hasPermission(role, "recommendation-drafts:write")
          ).toBe(true);
        }
      }
    }
  );

  it("there is no student-facing route that can trigger an analysis", () => {
    const studentRoutes = SOURCES.filter((source) =>
      /^src\/app\/(studio|\(site\)|api)\//.test(source.rel)
    );

    const bad = studentRoutes.filter((source) =>
      /career-intelligence\/service|requestCareerAnalysis|@\/lib\/ai\/get-provider/.test(
        source.text
      )
    ).map((source) => source.rel);

    expect(bad).toEqual([]);
  });
});

// ============================================================
// 3. NW09 DATABASE MIGRATION SECURITY
// ============================================================

describe("proposed migration NW09_ai_career_intelligence.sql", () => {
  const sql = read(
    "supabase/migrations-proposed/NW09_ai_career_intelligence.sql"
  );

  const fn = (signature: string): string => {
    const start = sql.indexOf(signature);

    expect(start).toBeGreaterThan(-1);

    return sql.slice(start, sql.indexOf("\n$$;", start));
  };

  it("fails fast unless NW07 is applied first", () => {
    expect(sql).toMatch(
      /to_regclass\('public\.recommendation_drafts'\) is null/
    );

    expect(sql).toMatch(
      /to_regprocedure\('public\.counsellor_has_case_access\(uuid\)'\) is null/
    );
  });

  it(
    "enables RLS, grants staff-only reads, and has no student or direct write policy",
    () => {
      expect(sql).toMatch(
        /alter table public\.ai_generation_runs enable row level security/
      );

      expect(sql).toMatch(
        /alter table public\.ai_usage_settings enable row level security/
      );

      expect(sql).not.toMatch(
        /auth\.uid\(\) = (student_user_id|ai_generation_runs\.student_user_id)/
      );

      expect(sql).not.toMatch(
        /on public\.ai_generation_runs for (insert|update|delete|all)/
      );

      expect(sql).toMatch(
        /counsellor_has_case_access\(ai_generation_runs\.student_user_id\)/
      );
    }
  );

  it("forbids recording a real student as processed by Gemini", () => {
    expect(sql).toMatch(
      /check \(provider <> 'gemini' or data_class = 'fictional'\)/
    );

    expect(
      fn("function public.staff_reserve_ai_generation_run(")
    ).toMatch(
      /p_provider = 'gemini' and p_data_class <> 'fictional'/
    );
  });

  it(
    "every function is SECURITY DEFINER with a pinned search_path and restricted execution",
    () => {
      const functions = [
        "staff_reserve_ai_generation_run",
        "staff_complete_ai_generation_run",
        "staff_link_ai_generation_run_draft",
        "admin_purge_ai_generation_reports",
      ];

      for (const name of functions) {
        const body = fn(`function public.${name}(`);

        expect(body).toMatch(/security definer/);
        expect(body).toMatch(/set search_path = public/);

        expect(sql).toMatch(
          new RegExp(
            `revoke execute on function public\\.${name}\\([^)]*\\) from public;`
          )
        );
      }
    }
  );

  it(
    "reserve re-checks caller, consent, limits and duplicate requests",
    () => {
      const body = fn(
        "function public.staff_reserve_ai_generation_run("
      );

      expect(body).toMatch(
        /public\.is_admin_role\(array\['super_admin', 'admin'\]\)/
      );

      expect(body).toMatch(
        /public\.counsellor_has_case_access\(p_student_user_id\)/
      );

      expect(body).toMatch(
        /p_consent_confirmed is distinct from true/
      );

      expect(body).toMatch(/pg_advisory_xact_lock/);

      expect(body).toMatch(
        /least\(coalesce\(p_limit_staff_daily, 0\), v_settings\.per_staff_daily\)/
      );

      expect(body).toMatch(
        /least\(coalesce\(p_monthly_budget_usd, 0\), v_settings\.monthly_budget_usd\)/
      );

      expect(body).toMatch(/'duplicate'/);

      expect(sql).toMatch(
        /constraint ai_generation_runs_unique_request unique \(requested_by, idempotency_key\)/
      );
    }
  );

  it("only the requester can complete or link a run, exactly once", () => {
    const complete = fn(
      "function public.staff_complete_ai_generation_run("
    );

    expect(complete).toMatch(/for update/);

    expect(complete).toMatch(
      /requested_by is distinct from auth\.uid\(\)/
    );

    expect(complete).toMatch(
      /v_run\.status <> 'reserved'/
    );

    const link = fn(
      "function public.staff_link_ai_generation_run_draft("
    );

    expect(link).toMatch(
      /requested_by is distinct from auth\.uid\(\)/
    );

    expect(link).toMatch(/d\.status = 'draft'/);
  });

  it("retention purge is super-admin only with a minimum period", () => {
    const body = fn(
      "function public.admin_purge_ai_generation_reports("
    );

    expect(body).toMatch(
      /is_admin_role\(array\['super_admin'\]\)/
    );

    expect(body).toMatch(
      /p_older_than_days < 30/
    );
  });
});
