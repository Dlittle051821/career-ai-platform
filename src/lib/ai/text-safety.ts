/**
 * NW09 — text hygiene for anything that goes INTO a prompt.
 *
 * - cleanText: strips control/format characters (incl. zero-width and bidi
 *   overrides used to hide instructions), collapses whitespace, and caps
 *   length. Applied to every catalogue string and every student free-text
 *   field.
 * - scrubPii: removes e-mail addresses, phone numbers, URLs and long digit
 *   runs (IDs, Aadhaar-like numbers) from student free text.
 * - looksLikeInstruction: flags text that tries to address the model; such
 *   text is still passed only as quoted DATA (never as instructions) and the
 *   flag is recorded for the counsellor.
 */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤﻿]/g;

export function cleanText(value: string | null | undefined, maxChars: number): string {
  if (!value) return "";
  const s = value.replace(CONTROL, "").replace(/[<>`]/g, "").replace(/\s+/g, " ").trim();
  return s.length > maxChars ? `${s.slice(0, maxChars - 1).trimEnd()}…` : s;
}

export function scrubPii(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
    .replace(/\bhttps?:\/\/\S+|\bwww\.\S+/gi, "[link removed]")
    .replace(/(?:\+?\d[\s-]?){8,}\d/g, "[number removed]");
}

const INSTRUCTION_PATTERNS = [
  /\bignore (all |any |the )?(previous|prior|above|earlier) (instructions|rules|prompts?)\b/i,
  /\b(system|developer) (prompt|message|instructions?)\b/i,
  /\byou are (now )?(an?|the) (ai|assistant|model|chatbot)\b/i,
  /\b(disregard|override|forget) (your|all|the) (rules|instructions|guidelines)\b/i,
  /\breturn (only )?(the )?json\b|\boutput (the following|exactly)\b/i,
  /\bnew instructions?\b|\bact as\b/i,
];

export function looksLikeInstruction(value: string): boolean {
  return INSTRUCTION_PATTERNS.some((p) => p.test(value));
}
