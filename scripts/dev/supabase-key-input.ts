/**
 * Input handling for the STAGING service-role key used by
 * scripts/dev/create-test-counsellor.ts. Nothing here prints, logs or returns
 * the key inside any message: every error/reason string is built from fixed
 * text plus non-secret facts (length, key kind).
 *
 * Pure functions take injectable runners so they can be tested without a
 * clipboard, a PowerShell process or a network request.
 */
import { spawnSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Normalisation and format validation
// ---------------------------------------------------------------------------

const QUOTES = /^["'`‘’“”]+|["'`‘’“”]+$/g;
// BOM, zero-width and other invisible characters a terminal/clipboard can add.
const INVISIBLE = /[﻿​-‍⁠­]/g;

/** Trim whitespace (including any CR/LF inside the paste), invisible characters, quotation marks and a pasted `NAME=` prefix. */
export function normaliseKey(raw: string | null | undefined): string {
  let key = (raw ?? "").replace(INVISIBLE, "").replace(/\s+/g, "");
  key = key.replace(/^(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|service_role)[:=]/i, "");
  key = key.replace(QUOTES, "");
  return key;
}

export type KeyCheck =
  | { ok: true; kind: "legacy_service_role_jwt" | "secret_key" }
  | { ok: false; reason: string };

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const json = Buffer.from(token.split(".")[1], "base64url").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Validate the key's format offline and, for legacy JWT keys, that it was issued for `expectedRef`. */
export function checkKeyFormat(key: string, expectedRef: string): KeyCheck {
  if (!key) return { ok: false, reason: "The clipboard/input was empty." };
  if (key.startsWith("sb_publishable_")) return { ok: false, reason: "That is the publishable key, not the service_role / sb_secret_ key." };
  if (key.startsWith("sb_secret_")) {
    return /^sb_secret_[A-Za-z0-9_-]{16,}$/.test(key)
      ? { ok: true, kind: "secret_key" }
      : { ok: false, reason: `The sb_secret_ key looks incomplete or contains unexpected characters (${key.length} characters read).` };
  }
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) {
    const payload = decodeJwtPayload(key);
    if (!payload) return { ok: false, reason: "The JWT key could not be decoded — it may be truncated." };
    if (payload.role === "anon") return { ok: false, reason: "That is the anon (public) key, not the service_role key." };
    if (payload.role !== "service_role") return { ok: false, reason: "That JWT is not a service_role key." };
    if (payload.ref !== expectedRef) return { ok: false, reason: "That service_role key belongs to a different Supabase project." };
    return { ok: true, kind: "legacy_service_role_jwt" };
  }
  return {
    ok: false,
    reason: `Unrecognised key format (${key.length} characters read; expected "sb_secret_…" or a JWT starting "eyJ"). Copy the whole key with the copy button in Supabase.`,
  };
}

// ---------------------------------------------------------------------------
// Windows clipboard via a child PowerShell process
// ---------------------------------------------------------------------------

export interface PsResult {
  status: number | null;
  stdout: string;
}
/** Runs a PowerShell command; the command text never contains the secret. */
export type PsRunner = (command: string) => PsResult;

export const defaultPsRunner: PsRunner = (command) => {
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-STA", "-Command", command], {
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"], // captured internally, never echoed
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });
  return { status: r.status, stdout: r.stdout ?? "" };
};

const READ_COMMAND = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Clipboard -Raw";
const CLEAR_COMMAND =
  "try { Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::Clear() } catch { Set-Clipboard -Value ' ' }";

export class ClipboardError extends Error {}

/**
 * Read the clipboard, then clear it — always, even if reading or validation
 * fails afterwards. Returns the normalised key and whether clearing was
 * confirmed (by reading the clipboard back and comparing internally).
 */
export function takeKeyFromClipboard(run: PsRunner = defaultPsRunner, platform: NodeJS.Platform = process.platform): { key: string; cleared: boolean } {
  if (platform !== "win32") throw new ClipboardError("--key-from-clipboard needs Windows PowerShell. Use the hidden prompt instead (omit the flag).");
  let raw = "";
  try {
    const read = run(READ_COMMAND);
    if (read.status !== 0) throw new ClipboardError(`Could not read the clipboard (PowerShell exit code ${read.status ?? "timeout"}).`);
    raw = read.stdout;
  } finally {
    run(CLEAR_COMMAND);
  }
  const key = normaliseKey(raw);
  const after = run(READ_COMMAND);
  const cleared = after.status === 0 && (key === "" || normaliseKey(after.stdout) !== key);
  return { key, cleared };
}

// ---------------------------------------------------------------------------
// Authenticated check: the key really works for THIS project
// ---------------------------------------------------------------------------

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string> }) => Promise<{ status: number }>;

/**
 * One read-only Admin API call (list at most one user) against the staging
 * URL. Keys are project-scoped, so a 200 proves the key belongs to this
 * project. Messages never include the key.
 */
export async function verifyKeyWithProject(projectUrl: string, key: string, fetchImpl: FetchLike = fetch as unknown as FetchLike): Promise<{ ok: true } | { ok: false; reason: string }> {
  let status: number;
  try {
    const res = await fetchImpl(`${projectUrl.replace(/\/+$/, "")}/auth/v1/admin/users?page=1&per_page=1`, {
      method: "GET",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    status = res.status;
  } catch {
    return { ok: false, reason: "Could not reach the staging Supabase project to verify the key (network error)." };
  }
  if (status === 200) return { ok: true };
  if (status === 401 || status === 403) return { ok: false, reason: `Supabase rejected the key for project (HTTP ${status}): it is not a valid service_role / secret key for this project.` };
  return { ok: false, reason: `Unexpected response while verifying the key (HTTP ${status}).` };
}
