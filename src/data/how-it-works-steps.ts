import { Compass, ClipboardList, FileCheck, GraduationCap, Plane, type LucideIcon } from "lucide-react";
import type { JourneyStageId } from "@/types";

/**
 * UX10-HW01 "How It Works Redesign" — a curated 5-step presentation of the
 * real 10-stage journey in `src/data/journey.ts` (`JOURNEY_STAGES`), built
 * for the approved reference image's "clear 5-step journey" section.
 *
 * This does NOT invent a second, different process. Every step's
 * `stageIds` names the exact real `JourneyStage`s it summarizes, and each
 * step's `description` is a compressed paraphrase of those stages' own
 * `summary` text — never a new claim, stat, or outcome. Together the five
 * steps' `stageIds` cover all ten real stages exactly once:
 *
 *   explore            -> self-understanding, career-exploration, skills, course
 *   personalised-plan  -> india-abroad, university, finance
 *   prepare-and-apply  -> admission
 *   admission-and-visa -> visa
 *   next-chapter       -> internship
 *
 * The full, uncompressed 10-stage detail (free vs. paid support per stage)
 * stays reachable on the same page via the existing `JourneySteps`
 * "detailed" variant, reused as-is inside a progressive-disclosure panel —
 * see `JourneyStepFlow.tsx`. Nothing here replaces that real data, it only
 * adds a compact visual summary above it.
 */
export interface HowItWorksStep {
  id: string;
  order: number;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Keys into the shared `surface-soft-*` / brand tokens — see JourneyStepFlow.tsx's TONE_CLASSES. No new colors invented. */
  tone: "blue" | "lavender" | "cyan" | "amber" | "ink";
  stageIds: JourneyStageId[];
}

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    id: "explore",
    order: 1,
    title: "Explore your options",
    description:
      "Reflect on your interests, strengths and goals, then explore career directions, skill gaps and course options that genuinely fit — before locking in a country or university.",
    icon: Compass,
    tone: "blue",
    stageIds: ["self-understanding", "career-exploration", "skills", "course"],
  },
  {
    id: "personalised-plan",
    order: 2,
    title: "Get a personalised plan",
    description:
      "Compare India and abroad on cost, duration and work exposure, shortlist universities that fit, and map out a realistic finance and application plan for your goals.",
    icon: ClipboardList,
    tone: "lavender",
    stageIds: ["india-abroad", "university", "finance"],
  },
  {
    id: "prepare-and-apply",
    order: 3,
    title: "Prepare and apply",
    description:
      "Prepare applications, essays and documentation with a clear timeline and review support, so you can apply with confidence and fewer last-minute surprises.",
    icon: FileCheck,
    tone: "cyan",
    stageIds: ["admission"],
  },
  {
    id: "admission-and-visa",
    order: 4,
    title: "Get admission and visa support",
    description:
      "As admission decisions arrive, get guidance on the general visa process and documentation expectations for your chosen country and course.",
    icon: GraduationCap,
    tone: "amber",
    stageIds: ["visa"],
  },
  {
    id: "next-chapter",
    order: 5,
    title: "Start your next chapter",
    description:
      "Translate study into employability — internships, resumes, interviews and a realistic first-job plan — with support that continues after you arrive.",
    icon: Plane,
    tone: "ink",
    stageIds: ["internship"],
  },
];
