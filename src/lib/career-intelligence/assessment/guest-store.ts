/**
 * Career Intelligence V2 — a guest's assessment progress on this device.
 *
 * Holds only assessment answers (see model.ts: no name, email, date of birth,
 * city or any other identifier) plus the section the student was on. Every
 * read and write is wrapped: storage can be missing, full or blocked, and the
 * assessment must keep working without it. What comes back is re-sanitised,
 * so a hand-edited value can never reach a save or the teaser unchecked.
 */
import { emptyAnswers, sanitizeAnswers, type AssessmentAnswers } from "./model";

const KEY = "nw-ci-assessment-v1";
/** Fired on this page after every write, so components reading the device copy stay in step. */
export const GUEST_PROGRESS_EVENT = "nw:ci-guest-progress";
const PLAN_KEY = "nw-ci-plan-choice";

export interface GuestProgress {
  answers: AssessmentAnswers;
  step: number;
  updatedAt: number;
}

/** The stored value as text (stable between calls, for useSyncExternalStore); null when absent or unreadable. */
export function readGuestProgressRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function parseGuestProgress(raw: string | null): GuestProgress | null {
  try {
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const p = parsed as { answers?: unknown; step?: unknown; updatedAt?: unknown };
    const step = typeof p.step === "number" && Number.isInteger(p.step) && p.step >= 0 && p.step < 8 ? p.step : 0;
    return { answers: sanitizeAnswers(p.answers ?? emptyAnswers()), step, updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : 0 };
  } catch {
    return null;
  }
}

export function readGuestProgress(): GuestProgress | null {
  return parseGuestProgress(readGuestProgressRaw());
}

const announce = () => {
  try {
    window.dispatchEvent(new Event(GUEST_PROGRESS_EVENT));
  } catch {
    /* no listeners to tell */
  }
};

/** Returns false when the device would not store it, so the page can say so honestly. */
export function writeGuestProgress(answers: AssessmentAnswers, step: number): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ answers, step, updatedAt: Date.now() }));
    announce();
    return true;
  } catch {
    return false;
  }
}

export function clearGuestProgress(): void {
  try {
    window.localStorage.removeItem(KEY);
    announce();
  } catch {
    /* nothing to clear */
  }
}

/** The plan a student picked before signing in, so the choice survives the detour. A choice only — it grants nothing. */
export function rememberPlanChoice(slug: string): void {
  try {
    window.sessionStorage.setItem(PLAN_KEY, slug);
  } catch {
    /* optional */
  }
}

export function readPlanChoice(): string | null {
  try {
    return window.sessionStorage.getItem(PLAN_KEY);
  } catch {
    return null;
  }
}
