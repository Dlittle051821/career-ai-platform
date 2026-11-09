/**
 * NW-V4 "Connected Experience" homepage — content and routes.
 *
 * Copy is carried over verbatim from the approved V4 Connected Experience
 * prototype. Every in-product preview (career profile, Student Studio) is
 * labelled illustrative in the UI; destination summaries are orientation
 * text that links to each country's official source. No statistics,
 * ratings, testimonials or scores appear anywhere on the page.
 *
 * Every href below is an existing route in this repository (asserted by
 * src/lib/home/v4/v4-home.test.ts) — nothing here invents a new page.
 */

export const V4_ROUTES = {
  careers: "/careers",
  abroad: "/abroad",
  compareCareers: "/compare",
  register: "/register",
  saveToStudio: "/register?next=/studio",
  bookSession: "/book-counselling",
  universities: "/universities",
  courses: "/courses",
  howItWorks: "/how-it-works",
  privacy: "/privacy",
  terms: "/terms",
  contact: "/contact",
} as const;

export type V4Route = (typeof V4_ROUTES)[keyof typeof V4_ROUTES];

/** Scene indices — the stage has seven layers, L0…L6. */
export const V4_SCENES = {
  intro: 0,
  pathways: 1,
  careers: 2,
  abroad: 3,
  studio: 4,
  trust: 5,
  final: 6,
} as const;

export type V4DestinationKey = "de" | "ie" | "nl" | "fr" | "se" | "dk";

export type V4Destination = {
  key: V4DestinationKey;
  /** ISO code understood by /courses?destination= (a launch country). */
  code: "DE" | "IE" | "NL" | "FR" | "SE" | "DK";
  name: string;
  objectPosition: string;
  levels: string;
  fees: string;
  language: string;
  apply: string;
  sourceLabel: string;
  sourceUrl: string;
};

export const V4_DESTINATIONS: readonly V4Destination[] = [
  {
    key: "de",
    code: "DE",
    name: "Germany",
    objectPosition: "50% 60%",
    levels: "Bachelor's · Master's · PhD",
    fees: "Most public universities charge no tuition fees; a semester contribution applies. Some states charge non-EU students — check each programme.",
    language: "Many Master's programmes are taught in English. Most Bachelor's programmes require German.",
    apply: "Directly to the university or through uni-assist, depending on the programme.",
    sourceLabel: "DAAD — daad.de",
    sourceUrl: "https://www.daad.de/en/",
  },
  {
    key: "ie",
    code: "IE",
    name: "Ireland",
    objectPosition: "50% 35%",
    levels: "Bachelor's · Master's · PhD",
    fees: "Set by each institution, and different for EU and non-EU students.",
    language: "Programmes are taught in English.",
    apply: "Through the CAO for many undergraduate applicants, or directly to the institution.",
    sourceLabel: "Education in Ireland — educationinireland.com",
    sourceUrl: "https://www.educationinireland.com/",
  },
  {
    key: "nl",
    code: "NL",
    name: "Netherlands",
    objectPosition: "40% 50%",
    levels: "Bachelor's · Master's · PhD",
    fees: "EU/EEA students usually pay the statutory fee; non-EU students pay an institutional fee set by each university.",
    language: "A wide range of English-taught programmes, especially at Master's level.",
    apply: "Through Studielink, plus any university-specific steps.",
    sourceLabel: "Study in NL — studyinnl.org",
    sourceUrl: "https://www.studyinnl.org/",
  },
  {
    key: "fr",
    code: "FR",
    name: "France",
    objectPosition: "50% 30%",
    levels: "Licence · Master · Doctorat",
    fees: "Public universities charge state-set registration fees; many apply higher fees for non-EU students.",
    language: "Most programmes are taught in French; English-taught options are growing, mainly at Master's level.",
    apply: "Many non-EU students apply through the Études en France procedure.",
    sourceLabel: "Campus France — campusfrance.org",
    sourceUrl: "https://www.campusfrance.org/en",
  },
  {
    key: "se",
    code: "SE",
    name: "Sweden",
    objectPosition: "50% 50%",
    levels: "Bachelor's · Master's · PhD",
    fees: "No tuition for EU/EEA and Swiss citizens. Others pay tuition and an application fee.",
    language: "Many Master's programmes are taught in English.",
    apply: "Through University Admissions in Sweden for most programmes.",
    sourceLabel: "Study in Sweden — studyinsweden.se",
    sourceUrl: "https://studyinsweden.se/",
  },
  {
    key: "dk",
    code: "DK",
    name: "Denmark",
    objectPosition: "50% 50%",
    levels: "Bachelor's · Master's · PhD",
    fees: "No tuition for EU/EEA and Swiss citizens. Others pay tuition set by each institution.",
    language: "Many Master's and some Bachelor's programmes are taught in English.",
    apply: "Bachelor's through optagelse.dk; Master's usually directly to the university.",
    sourceLabel: "Study in Denmark — studyindenmark.dk",
    sourceUrl: "https://studyindenmark.dk/",
  },
];

export const V4_CAREER_TABS = [
  { key: "overview", label: "Overview" },
  { key: "day", label: "Day to day" },
  { key: "routes", label: "Entry routes" },
  { key: "skills", label: "Skills" },
] as const;

export const V4_TRUST_STATEMENT =
  "Student-first guidance, built on verified information — with real people beside you at every step.";

export const V4_PILLARS = [
  { title: "Student-first", body: "Guidance shaped around your goals — not around selling a particular university or country." },
  { title: "Verified information", body: "Fees and requirements are linked to official sources, so you can check every detail." },
  { title: "Technology + people", body: "Explore on your own with clear tools, then talk it through with an adviser." },
  { title: "Parents welcome", body: "Parents and guardians can join sessions and follow the plan with you." },
] as const;

export function coursesForDestination(code: V4Destination["code"]): string {
  return `${V4_ROUTES.courses}?destination=${code}`;
}
