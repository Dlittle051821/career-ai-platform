/**
 * Milestone 9 — applies the hand-written, idempotent Global Education Data
 * dev seed (supabase/seed/0003_global_education_dev_seed.sql) to a Supabase
 * project's Postgres database directly, via a raw connection string.
 *
 * Run with: npm run seed:education-data -- [--yes]
 *
 * Every insert in that seed file uses `on conflict (...) do nothing`, so
 * running this script is always safe to repeat — it will never duplicate or
 * clobber existing rows. See that file's own header comment for exactly
 * what data it contains (a small, real, officially-sourced starter dataset
 * — explicitly NOT a complete database).
 *
 * Requires SUPABASE_DB_URL (loaded from .env.local, falling back to an
 * already-exported shell/CI var) — a raw Postgres connection string from
 * your Supabase project's Database Settings -> Connection string -> URI,
 * with the password filled in. This is used ONLY by this script, never by
 * the Next.js app itself.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { confirmOrAbort, loadEducationCliEnv, maskConnectionStringPassword, parseCliArgs, requireEnvVar } from "./lib/education-cli-shared";

loadEducationCliEnv();

const SEED_FILE_PATH = resolve(__dirname, "..", "supabase", "seed", "0003_global_education_dev_seed.sql");

function printUsage(): void {
  console.log(`
Usage: npm run seed:education-data -- [--yes]

Applies supabase/seed/0003_global_education_dev_seed.sql to the Postgres
database at SUPABASE_DB_URL. Every insert in that file uses
"on conflict (...) do nothing", so this is always safe to (re-)run.

Options:
  --yes    Skip the interactive y/N confirmation (for CI).
  --help   Show this message and exit.

Requires environment variable (loaded from .env.local, falling back to an
already-exported shell/CI var):
  SUPABASE_DB_URL   Postgres connection string (Database Settings ->
                     Connection string -> URI, password filled in).
`);
}

/** Best-effort, human-readable preview of the seed file's contents: counts each "insert into public.X" statement per table via a simple regex scan. Good enough for a confirmation prompt — not a substitute for reading the file. */
function summarizeInsertsByTable(sql: string): Map<string, number> {
  const counts = new Map<string, number>();
  const re = /insert\s+into\s+public\.(\w+)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) {
    const table = match[1];
    counts.set(table, (counts.get(table) ?? 0) + 1);
  }
  return counts;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { flags, help } = parseCliArgs(argv);

  if (help) {
    printUsage();
    process.exit(0);
  }
  const autoYes = flags.yes === true;

  let connectionString: string;
  try {
    connectionString = requireEnvVar(
      "SUPABASE_DB_URL",
      "Find it in your Supabase project's Database Settings -> Connection string -> URI (fill in your database password), and add it to .env.local. Never used by the Next.js app itself.",
    );
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  let sql: string;
  try {
    sql = readFileSync(SEED_FILE_PATH, "utf8");
  } catch (e) {
    console.error(`Could not read seed file at ${SEED_FILE_PATH}: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  const counts = summarizeInsertsByTable(sql);
  console.log(`\nSeed file: ${SEED_FILE_PATH}`);
  console.log(`Target database: ${maskConnectionStringPassword(connectionString)}`);
  console.log(`\nThis will attempt approximately:`);
  if (counts.size === 0) {
    console.log("  (no \"insert into public.X\" statements detected)");
  } else {
    for (const [table, count] of counts) {
      console.log(`  ~${count} insert(s) into public.${table}`);
    }
  }
  console.log(`\nEvery insert uses "on conflict (...) do nothing", so this is always safe to (re-)run — it will never duplicate or overwrite existing rows.`);

  const proceed = await confirmOrAbort("Continue?", autoYes);
  if (!proceed) {
    console.log("Aborted. No changes were made.");
    process.exit(0);
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query(sql);
    console.log("\nSeed applied successfully.\n");
  } catch (e) {
    console.error(`\nSeed failed: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
