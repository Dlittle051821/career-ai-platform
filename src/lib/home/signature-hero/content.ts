import { MAIN_NAV } from "@/config/site";
import { EUROPE_COUNTRIES } from "@/data/europe-explorer";
import type { Vec2 } from "./geometry";

/**
 * NW08.7 — words, links and photographs for the signature homepage hero.
 *
 * Every link resolves to an existing public route. Labels for the two
 * pathways come from MAIN_NAV, so they can never drift from the approved
 * primary navigation. No statistics, partnerships or results are claimed.
 */

type NavLink = (typeof MAIN_NAV)[number];

function nav(href: string): NavLink {
  const link = MAIN_NAV.find((l) => l.href === href);
  if (!link) throw new Error(`MAIN_NAV has no entry for ${href}`);
  return link;
}

export const HERO_COPY = {
  /** Rendered as "Turn ambition into" + emphasised "opportunity." — per the approved reference. */
  headlineLead: "Turn ambition into",
  headlineEmphasis: "opportunity.",
  body: "Explore career possibilities, discover educational opportunities and plan your next chapter.",
} as const;

/** Same two destinations the current homepage hero already uses (src/components/sections/home/HomeHero.tsx). */
export const HERO_ACTIONS = {
  primary: { label: "Start your journey", href: "/career-discovery" },
  secondary: { label: "Study in Europe", href: "/study-europe" },
} as const;

const CAREER = nav("/career");
const ABROAD = nav("/abroad");

export const PATHWAYS = {
  career: { key: "career", label: CAREER.label, href: CAREER.href, note: "Career guidance in India" },
  abroad: { key: "abroad", label: ABROAD.label, href: ABROAD.href, note: `${EUROPE_COUNTRIES.length} European countries` },
} as const;

export type PathwayKey = keyof typeof PATHWAYS;

export interface HeroPhotograph {
  id: string;
  src: string;
  /** Intrinsic pixel size. */
  size: readonly [number, number];
  /** Where the subject of interest is, 0–1 in image space. */
  focal: Vec2;
  /** For the portrait: the face, which must never be cut by the ribbon. */
  face?: { centre: Vec2; radius: number };
  /** Optional second focal point the scene pans towards. */
  panTo?: Vec2;
  /** Text alternative; the photographs are illustrative and never presented as real Nextwise students. */
  alt: string;
}

/**
 * Both photographs are existing repository assets already published on
 * nextwise.world (HomeHero, CareersHero, EuropeExplorerHero, ProfileWorkspace).
 * See docs/milestones/NW08.7/NW087_H04_ASSET_INVENTORY.md for provenance.
 */
export const PHOTOGRAPHS = {
  portrait: {
    id: "portrait",
    src: "/hero/nextwise-student-hero.png",
    size: [900, 1125],
    focal: [0.47, 0.36],
    face: { centre: [0.47, 0.33], radius: 0.085 },
    alt: "Illustrative image: a young woman with a laptop smiles as she looks ahead, a university skyline behind her.",
  },
  campus: {
    id: "campus",
    src: "/hero/campus-sky-backdrop.png",
    size: [1672, 941],
    focal: [0.76, 0.52],
    panTo: [0.52, 0.56],
    alt: "Illustrative image: a historic European university campus and a modern city skyline under a bright sky.",
  },
} as const satisfies Record<string, HeroPhotograph>;
