/**
 * NW-V5.6.3 — Career Intelligence preview (homepage scene 3).
 *
 * An ILLUSTRATIVE career profile, not a recommendation: it is the same for every
 * visitor, never reads a student's profile, and never calls the recommendation
 * engine. Everything factual on the card comes from the verified career records
 * in src/data/careers (dataQualityStatus "approved"), through the product's own
 * label helpers — the homepage adds a display title, a one-line invitation and
 * four topic tags, and nothing else. No match scores, salaries, growth figures,
 * eligibility, rankings or outcomes are shown.
 */
import { ALL_CAREERS } from "@/data/careers";
import { educationLevelLabel, fieldLabel, skillLabel, subjectLabel } from "@/lib/careers/labels";

export type CareerArtwork = "robotics" | "energy" | "space";

type Showcase = {
  key: CareerArtwork;
  /** short label for the selector */
  tab: string;
  /** display title on the homepage card */
  title: string;
  /** one plain-language line, no claims or figures */
  invitation: string;
  tags: readonly [string, string, string, string];
  /** the verified record the facts come from */
  slug: string;
};

/** The three illustrative careers, Robotics first (the featured one). */
export const CAREER_SHOWCASE: readonly Showcase[] = [
  {
    key: "robotics",
    tab: "Robotics",
    title: "Robotics & Autonomous Systems Engineer",
    invitation: "Design intelligent machines and autonomous systems that transform how we live, work and explore.",
    tags: ["Robotics", "Automation", "Artificial Intelligence", "Engineering"],
    slug: "robotics-engineer",
  },
  {
    key: "energy",
    tab: "Climate & Energy",
    title: "Climate & Energy Systems Engineer",
    invitation: "Shape how energy is generated, stored and shared — for homes, cities and industry.",
    tags: ["Energy", "Climate", "Power systems", "Engineering"],
    slug: "energy-systems-engineer",
  },
  {
    key: "space",
    tab: "Space Systems",
    title: "Space Systems Engineer",
    invitation: "Design the spacecraft and aircraft systems that carry people and ideas further.",
    tags: ["Space", "Aerospace", "Simulation", "Engineering"],
    slug: "aerospace-engineer",
  },
];

/** The canonical, working Career Explorer route (the /careers listing with search and filters). */
export const CAREER_EXPLORER_HREF = "/careers";

export type CareerPreviewItem = {
  key: CareerArtwork;
  tab: string;
  title: string;
  invitation: string;
  tags: readonly string[];
  /** the verified record's own title and route */
  profileTitle: string;
  profileHref: string;
  involves: string;
  skills: string[];
  foundations: { subjects: string[]; route: string };
  related: string[];
};

export function buildCareerPreview(): CareerPreviewItem[] {
  return CAREER_SHOWCASE.map((s) => {
    const c = ALL_CAREERS.find((r) => r.slug === s.slug);
    if (!c || c.dataQualityStatus !== "approved") throw new Error(`V5.6.3 career preview: no approved record for ${s.slug}`);
    const primary = c.educationRoutes.find((r) => r.relevance === "primary") ?? c.educationRoutes[0];
    return {
      key: s.key,
      tab: s.tab,
      title: s.title,
      invitation: s.invitation,
      tags: s.tags,
      profileTitle: c.title,
      profileHref: `/careers/${c.slug}`,
      involves: c.summary,
      skills: [...c.skills].sort((a, b) => b.importance - a.importance).slice(0, 4).map((k) => skillLabel(k.skillKey)),
      foundations: {
        subjects: [...c.subjects].sort((a, b) => b.importance - a.importance).slice(0, 3).map((k) => subjectLabel(k.subjectKey)),
        route: primary ? `${educationLevelLabel(primary.educationLevel)} in ${fieldLabel(primary.fieldKey)}` : "",
      },
      related: (c.relatedCareerKeys ?? [])
        .map((k) => ALL_CAREERS.find((r) => r.careerKey === k)?.title)
        .filter((t): t is string => Boolean(t))
        .slice(0, 3),
    };
  });
}
