/**
 * Milestone 9 — small shared helpers for the two DB-touching CLI tools
 * (`scripts/import-education-data.ts`, `scripts/seed-education-data.ts`):
 * `.env.local` loading, manual `--flag=value` argv parsing, and the
 * mandatory y/N confirmation prompt these tools' spec requires before any
 * write. Kept tiny and dependency-light on purpose — this project has no
 * `commander`/`yargs` anywhere and shouldn't gain one just for these two
 * scripts.
 *
 * `scripts/validate-education-data.ts` does NOT use this file — it is a
 * pure, offline, no-DB, no-env tool and stays that way (see that file's
 * top-of-file docblock).
 */
import { config as loadDotenv } from "dotenv";
import { createInterface } from "node:readline/promises";

/**
 * Loads `.env.local` (this repo's existing convention — see .env.example's
 * header comment) into `process.env`, silently doing nothing if the file
 * doesn't exist. Call this once, at the very top of a script's module body,
 * BEFORE reading any `process.env.*` value — a missing `.env.local` is not
 * an error here because already-exported shell vars or CI secrets must
 * still work as a fallback (spec requirement).
 */
export function loadEducationCliEnv(): void {
  loadDotenv({ path: ".env.local", quiet: true });
}

export interface ParsedCliArgs {
  /** Bare `--flag` -> `true`; `--flag=value` -> `"value"`. */
  flags: Record<string, string | boolean>;
  /** Convenience: true if `--help` (or `-h`) was passed. */
  help: boolean;
}

/** Parses `process.argv.slice(2)`-style argv into `--flag=value` / bare `--flag` pairs. No positional-argument support — this CLI contract doesn't need it. */
export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const flags: Record<string, string | boolean> = {};
  for (const arg of argv) {
    if (arg === "-h") {
      flags.help = true;
      continue;
    }
    if (!arg.startsWith("--")) continue;
    const eqIndex = arg.indexOf("=");
    if (eqIndex === -1) {
      flags[arg.slice(2)] = true;
    } else {
      flags[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1);
    }
  }
  return { flags, help: flags.help === true };
}

/** Reads a single flag's string value, or undefined if absent / passed bare (no `=value`). */
export function getStringFlag(flags: Record<string, string | boolean>, name: string): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

/**
 * The mandatory y/N confirmation gate every destructive/upsert CLI
 * operation must pass through before writing anything (spec requirement).
 * Returns true immediately, with no prompt, when `--yes` was passed (the
 * documented CI escape hatch). Anything other than an exact case-insensitive
 * "y"/"yes" answer counts as "no".
 */
export async function confirmOrAbort(promptMessage: string, autoYes: boolean): Promise<boolean> {
  if (autoYes) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${promptMessage} [y/N] `);
    return ["y", "yes"].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
}

/**
 * Masks the password portion of a Postgres connection string for safe
 * console output, e.g. `postgres://user:secret@host:5432/db` ->
 * `postgres://user:****@host:5432/db`. Falls back to returning the input
 * unchanged if it doesn't parse as a URL with embedded credentials (rather
 * than throwing) — this is a best-effort display helper, never a security
 * boundary in itself.
 */
export function maskConnectionStringPassword(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    if (url.password) {
      url.password = "****";
    }
    return url.toString();
  } catch {
    // Not a parseable URL (or no credentials) — mask defensively with a
    // regex fallback in case it's e.g. a keyword=value DSN with a password.
    return connectionString.replace(/(password=)[^&\s]+/i, "$1****");
  }
}

/**
 * Reads a required env var, throwing a plain, user-facing Error (no stack
 * trace expected to be shown — callers should catch and print `.message`
 * then exit 1) with guidance pointing at .env.example when it's missing.
 */
export function requireEnvVar(name: string, guidance: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. ${guidance}`);
  }
  return value;
}
