/**
 * NW09 — last line of defence against unsupported claims in model text.
 * Runs on every string of a validated answer. A sentence that states a
 * money figure, a percentage, a guarantee, or names a specific institution
 * is REMOVED (not rewritten) and the counsellor is told how many were
 * removed. The instructions already forbid these; this catches the cases
 * where a model ignores them.
 */
const PATTERNS: Array<{ re: RegExp; why: string }> = [
  { re: /(₹|\brs\.?\s?|\binr\b|\$|\busd\b|€|£)\s?\d|\b\d[\d,.]*\s?(lpa|lakhs?|crores?|per annum|p\.a\.|k per (month|year))\b/i, why: "money figure" },
  { re: /\b\d+(\.\d+)?\s?(%|percent\b|per cent\b)/i, why: "percentage" },
  { re: /\bguarantee(d|s)?\b|\bassured (admission|placement|job|selection)\b|\bwill (definitely|certainly) (get|be|succeed)\b|\b100 ?% (sure|certain|match)\b/i, why: "guarantee" },
  { re: /\b(?:[A-Z][a-zA-Z&.'-]+\s+){1,5}(University|College|Institute|Polytechnic|Academy)\b|\b(IIT|NIT|IIM|IIIT|AIIMS|BITS|NIFT|NID)\b/, why: "named institution" },
];

/** "not a guarantee", "no guarantee", "never guaranteed", "cannot guarantee" … are disclaimers, not promises. */
const NEGATED_GUARANTEE = /\b(not|no|never|without|cannot|can't|isn't|aren't|don't|doesn't|won't)\b(\s+\w+){0,3}\s+guarantee/gi;

export function offendingReason(s: string): string | null {
  for (const p of PATTERNS) {
    if (p.why === "guarantee") {
      if (p.re.test(s.replace(NEGATED_GUARANTEE, " "))) return p.why;
      continue;
    }
    if (p.re.test(s)) return p.why;
  }
  return null;
}

function sentences(s: string): string[] {
  return s.match(/[^.!?]+[.!?]*\s*/g) ?? [s];
}

export interface ScreenTally {
  removed: number;
  reasons: Set<string>;
}

/** Removes offending sentences from a paragraph; returns "" if nothing safe is left. */
export function screenText(s: string, tally: ScreenTally): string {
  const kept: string[] = [];
  for (const part of sentences(s)) {
    const why = offendingReason(part);
    if (why) {
      tally.removed += 1;
      tally.reasons.add(why);
    } else kept.push(part);
  }
  return kept.join("").trim();
}

/** Removes offending items from a list. */
export function screenList(items: string[], tally: ScreenTally): string[] {
  return items.map((i) => screenText(i, tally)).filter((i) => i.length > 0);
}
