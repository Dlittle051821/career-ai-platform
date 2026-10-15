import { LAUNCH_COUNTRY_PRIMARY_SOURCES } from "@/lib/education/external-search/launch-country-sources";

/**
 * UX10-EU01 "Europe Country Explorer" — the launch country registry and
 * official-source mapping for the new `/study-europe` page.
 *
 * WHY THIS IS A SEPARATE FILE FROM THE EXISTING M20 REGISTRY
 * (`src/lib/education/external-search/launch-country-sources.ts`): that
 * registry's six "Tier 1 launch countries" are DE/GB/US/CA/AU/IE — a
 * different, GLOBAL set (it powers the sitewide Trusted Global Course
 * Search on `/courses`/`/universities` and the homepage's
 * `TrustedStudyExplorer`). This milestone's brief is explicit and
 * repeated: EU01 is Europe-first and must show ONLY Germany, Ireland,
 * Netherlands, France, Sweden, and Denmark — never the UK, USA, Canada,
 * or Australia. Extending the M20 registry itself to this different
 * six-country set would change what every existing M20 consumer shows
 * (a real regression this milestone must not cause). So this is a new,
 * EU01-scoped list — but it REUSES, not duplicates, the two countries the
 * two registries share: Germany and Ireland's `authority`/`primaryDomain`/
 * `purpose` below are read directly from `LAUNCH_COUNTRY_PRIMARY_SOURCES`
 * (see `reuseM20Source` below), so this page can never drift from the
 * already-approved M20A copy for those two countries.
 *
 * NO FABRICATED DATA: every `officialSource` below (authority name +
 * domain) was verified directly against the organization's own live
 * homepage during this milestone's research (not guessed, not carried
 * over from training data alone):
 *   - Germany: reused from the existing M20A registry (already verified
 *     when that milestone shipped).
 *   - Ireland: reused from the existing M20A registry (already verified
 *     when that milestone shipped).
 *   - Netherlands: studyinnl.org's own "About Study in NL" page states
 *     "An initiative from Nuffic."
 *   - France: campusfrance.org's own footer describes Campus France as
 *     France's agency for promoting French higher education and
 *     welcoming international students, under the French Republic.
 *   - Sweden: studyinsweden.se's own "About this site" page states it is
 *     operated by the Swedish Institute, "a public agency tasked with
 *     promoting Sweden abroad."
 *   - Denmark: studyindenmark.dk's own "Study in Denmark" page states the
 *     site is managed by the Danish Ministry of Higher Education and
 *     Science.
 *
 * Every `tuitionProfile`/`englishAvailability`/`livingCostProfile`/
 * `admissionProfile`/`postStudyProfile` field is a QUALITATIVE profile
 * label, never a specific number — per this milestone's own explicit
 * instruction not to fabricate numeric ranges without a verifiable
 * source. Each is grounded in widely-documented, stable national policy
 * patterns researched this milestone (e.g. Germany's largely tuition-free
 * public universities; Sweden/Denmark's tuition-for-non-EU/free-for-EU
 * split, in place since 2011; France's well-documented 2019 "Bienvenue en
 * France" fee restructuring for non-EU students) — never invented. The
 * page itself additionally carries a visible disclaimer that all of this
 * is indicative and must be confirmed from official sources before
 * applying (see EuropeComparisonSection.tsx).
 */

export type EuropeCountryCode = "DE" | "IE" | "NL" | "FR" | "SE" | "DK";

export interface EuropeOfficialSource {
  authority: string;
  primaryDomain: string;
  url: string;
  purpose: string;
}

export interface EuropeCountry {
  code: EuropeCountryCode;
  name: string;
  /** Anchor-safe slug, e.g. "germany" — used for the Official Sources section's same-page anchors. */
  slug: string;
  recommended: boolean;
  tuitionProfile: string;
  englishAvailability: string;
  livingCostProfile: string;
  admissionProfile: string;
  postStudyProfile: string;
  officialSource: EuropeOfficialSource;
}

/** Reuses an existing M20A `LAUNCH_COUNTRY_PRIMARY_SOURCES` entry's authority/domain/purpose verbatim — never retyped. Throws at module-load time (immediately caught by this file's own test) if the M20A registry ever drops a country this page depends on. */
function reuseM20Source(countryCode: "DE" | "IE", url: string): EuropeOfficialSource {
  const entry = LAUNCH_COUNTRY_PRIMARY_SOURCES.find((source) => source.countryCode === countryCode);
  if (!entry) {
    throw new Error(`europe-explorer.ts expected an M20A LAUNCH_COUNTRY_PRIMARY_SOURCES entry for ${countryCode}`);
  }
  return { authority: entry.authority, primaryDomain: entry.primaryDomain, purpose: entry.purpose, url };
}

export const EUROPE_COUNTRIES: readonly EuropeCountry[] = [
  {
    code: "DE",
    name: "Germany",
    slug: "germany",
    recommended: true,
    tuitionProfile: "Low or no tuition at many public universities",
    englishAvailability: "Wide and growing range of English-taught Master's programmes",
    livingCostProfile: "Moderate — varies significantly by city",
    admissionProfile: "Structured, portal-based applications (e.g. uni-assist for many programmes)",
    postStudyProfile: "Post-study work options available for graduates — confirm current visa rules",
    officialSource: reuseM20Source("DE", "https://www.daad.de/en/"),
  },
  {
    code: "IE",
    name: "Ireland",
    slug: "ireland",
    recommended: false,
    tuitionProfile: "Moderate to higher — varies by institution and programme",
    englishAvailability: "English-taught by default (English-speaking country)",
    livingCostProfile: "Higher — especially in Dublin",
    admissionProfile: "Centralised and direct applications depending on course level",
    postStudyProfile: "Stay-back work options available for graduates — confirm current rules",
    officialSource: reuseM20Source("IE", "https://www.educationinireland.com/"),
  },
  {
    code: "NL",
    name: "Netherlands",
    slug: "netherlands",
    recommended: false,
    tuitionProfile: "Moderate to higher for non-EU/EEA students — varies by programme",
    englishAvailability: "One of Europe's widest ranges of English-taught programmes",
    livingCostProfile: "Moderate to higher — varies by city",
    admissionProfile: "Structured, programme-specific application deadlines",
    postStudyProfile: "Orientation-year work permit available for graduates — confirm current rules",
    officialSource: {
      authority: "Study in NL — Nuffic",
      primaryDomain: "studyinnl.org",
      url: "https://www.studyinnl.org",
      purpose: "Official guidance on studying in the Netherlands, programme search, and practical planning for international students.",
    },
  },
  {
    code: "FR",
    name: "France",
    slug: "france",
    recommended: false,
    tuitionProfile: "Fee structure has changed in recent years — confirm current rates with Campus France",
    englishAvailability: "Growing number of English-taught programmes, especially at Master's level",
    livingCostProfile: "Moderate — varies significantly by city (Paris is higher)",
    admissionProfile: "Centralised application platforms for many programmes",
    postStudyProfile: "Post-study residence options available for graduates — confirm current rules",
    officialSource: {
      authority: "Campus France",
      primaryDomain: "campusfrance.org",
      url: "https://www.campusfrance.org",
      purpose: "France's official agency for promoting French higher education and guiding international students through study and admission planning.",
    },
  },
  {
    code: "SE",
    name: "Sweden",
    slug: "sweden",
    recommended: false,
    tuitionProfile: "Tuition required for non-EU/EEA students; free for EU/EEA students",
    englishAvailability: "Many English-taught Master's programmes",
    livingCostProfile: "Moderate to higher — varies by city",
    admissionProfile: "Centralised national application system",
    postStudyProfile: "Post-study residence permit available for graduates — confirm current rules",
    officialSource: {
      authority: "Study in Sweden — Swedish Institute",
      primaryDomain: "studyinsweden.se",
      url: "https://studyinsweden.se",
      purpose: "Official Swedish Institute guidance on studying in Sweden — programmes, applications, and life as an international student.",
    },
  },
  {
    code: "DK",
    name: "Denmark",
    slug: "denmark",
    recommended: false,
    tuitionProfile: "Tuition required for non-EU/EEA students; free for EU/EEA students",
    englishAvailability: "Good range of English-taught programmes",
    livingCostProfile: "Higher — especially in Copenhagen",
    admissionProfile: "Structured national application process",
    postStudyProfile: "Post-study work options available for graduates — confirm current rules",
    officialSource: {
      authority: "Study in Denmark — Danish Ministry of Higher Education and Science",
      primaryDomain: "studyindenmark.dk",
      url: "https://studyindenmark.dk",
      purpose: "Official Danish government guidance on studying in Denmark, including institutions, programmes, and practical planning.",
    },
  },
] as const;

export function getEuropeCountry(code: EuropeCountryCode): EuropeCountry {
  const country = EUROPE_COUNTRIES.find((entry) => entry.code === code);
  if (!country) throw new Error(`Unknown EuropeCountryCode: ${code}`);
  return country;
}
