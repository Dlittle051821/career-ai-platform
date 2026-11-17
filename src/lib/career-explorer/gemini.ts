/**
 * Career Explorer V5 — the Gemini salary-research handoff.
 *
 * Nextwise does not publish salary figures and does not call a Gemini API.
 * The student gets a prepared question, copies it, and Gemini opens in a new
 * tab where they paste and send it themselves. Google documents no web link
 * that pre-fills or submits a prompt, so none is used here: GEMINI_APP_URL is
 * the plain app address, with no query string.
 *
 * Privacy: the question is built from the career title and the selected
 * countries only. Nothing about the student is ever included.
 */
export const GEMINI_APP_URL = "https://gemini.google.com/app";

export interface SalaryCountry {
  code: string;
  /** Name as written inside the question, e.g. "the Netherlands". */
  inSentence: string;
  /** Short chip label. */
  label: string;
}

/** India plus the six Nextwise launch destinations (src/data/europe-explorer.ts). */
export const SALARY_COUNTRIES: readonly SalaryCountry[] = [
  { code: "IN", label: "India", inSentence: "India" },
  { code: "DE", label: "Germany", inSentence: "Germany" },
  { code: "IE", label: "Ireland", inSentence: "Ireland" },
  { code: "NL", label: "Netherlands", inSentence: "the Netherlands" },
  { code: "FR", label: "France", inSentence: "France" },
  { code: "SE", label: "Sweden", inSentence: "Sweden" },
  { code: "DK", label: "Denmark", inSentence: "Denmark" },
];

/** Selected by default when the dialog opens. */
export const DEFAULT_SALARY_COUNTRY_CODES: readonly string[] = ["IN", "DE", "IE", "NL", "FR", "SE"];

export function joinCountryNames(names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Selected countries in the fixed SALARY_COUNTRIES order; unknown codes are ignored. */
export function resolveSalaryCountries(codes: readonly string[]): SalaryCountry[] {
  const wanted = new Set(codes);
  return SALARY_COUNTRIES.filter((c) => wanted.has(c.code));
}

/** Keeps only what belongs in a question: no line breaks, no control characters, bounded length. */
function cleanTitle(title: string): string {
  return title.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * The standardised salary-research question. Returns null when it cannot be
 * built honestly (no career title, or no country selected).
 */
export function buildSalaryPrompt(careerTitle: string, countryCodes: readonly string[]): string | null {
  const title = cleanTitle(careerTitle);
  const countries = resolveSalaryCountries(countryCodes);
  if (!title || countries.length === 0) return null;
  const where = joinCountryNames(countries.map((c) => c.inSentence));
  return [
    `Research the latest available salary information for the occupation "${title}".`,
    `Compare salaries in ${where} where reliable data is available. For each country, provide:`,
    "1. Typical entry-level, mid-career and senior-level salary",
    "2. Gross annual salary in local currency, as a range",
    "3. The source and reference year for every figure",
    "4. Regional or experience-based differences, and opportunities in that market",
    "Clearly distinguish mean, median and advertised estimates. Do not invent statistics or sources. Where reliable data is unavailable, say so. Finish with a short comparison that does not treat salary as the only deciding factor.",
  ].join("\n");
}
