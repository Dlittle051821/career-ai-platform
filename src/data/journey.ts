import type { JourneyStage } from "@/types";

/**
 * The ten-stage career-first journey referenced across the Home and
 * How It Works pages. Keep this list as the single source of truth so
 * both pages stay consistent.
 */
export const JOURNEY_STAGES: JourneyStage[] = [
  {
    id: "self-understanding",
    order: 1,
    title: "Understand yourself",
    summary:
      "Reflect on interests, strengths, academic performance, and what a good day at work would look like for you.",
    freeSupport: ["Guided self-reflection prompts", "Initial goals conversation"],
    paidSupport: ["Structured discovery assessment (in development)", "One-to-one interpretation session"],
    parentInvolvement: "Parents can join the initial conversation and add their own observations.",
  },
  {
    id: "career-exploration",
    order: 2,
    title: "Explore career directions",
    summary:
      "Move from vague ambition to a short list of realistic career directions worth researching further.",
    freeSupport: ["Career library previews", "Sample role explainers"],
    paidSupport: ["Personalised shortlist with reasoning", "Follow-up Q&A with a counsellor"],
  },
  {
    id: "skills",
    order: 3,
    title: "Identify skills and gaps",
    summary:
      "Compare the skills a target role needs against your current strengths to see what to build next.",
    freeSupport: ["General skill-category overview"],
    paidSupport: ["Individual skill-gap map", "Suggested learning sequence"],
  },
  {
    id: "course",
    order: 4,
    title: "Compare education pathways",
    summary:
      "Line up course options — subject, format, duration — against the career directions you're weighing.",
    freeSupport: ["Course-category explainers"],
    paidSupport: ["Course shortlist mapped to your goals", "Eligibility sanity-check"],
  },
  {
    id: "india-abroad",
    order: 5,
    title: "Compare India and abroad",
    summary:
      "Weigh cost, duration, work exposure, and lifestyle fit across Indian and international options side by side.",
    freeSupport: ["Illustrative comparison framework"],
    paidSupport: ["Pathway-specific comparison for your shortlist", "Risk and backup planning"],
  },
  {
    id: "university",
    order: 6,
    title: "Shortlist universities",
    summary:
      "Narrow down institutions using fit, recognition, cost, and realistic admission chances, not rankings alone.",
    freeSupport: ["How-to-research guide"],
    paidSupport: ["Curated shortlist support", "Application requirement checklist"],
  },
  {
    id: "finance",
    order: 7,
    title: "Plan finance and applications",
    summary:
      "Map total cost — tuition, living, insurance, buffer — against realistic financing options before applying.",
    freeSupport: ["Cost-category checklist"],
    paidSupport: ["Personalised finance plan", "Application timeline and document tracking"],
  },
  {
    id: "admission",
    order: 8,
    title: "Manage admission",
    summary: "Prepare applications, essays, and documentation with a clear timeline and review support.",
    freeSupport: ["Document checklist templates"],
    paidSupport: ["Application review support", "Defined counselling touchpoints"],
  },
  {
    id: "visa",
    order: 9,
    title: "Prepare for visa",
    summary:
      "Understand the general visa process and documentation expectations for your chosen country and course.",
    freeSupport: ["General process overview"],
    paidSupport: ["Visa-preparation guidance", "Pre-departure planning checklist"],
  },
  {
    id: "internship",
    order: 10,
    title: "Build internship and job readiness",
    summary:
      "Translate study into employability — internships, resumes, interviews, and a realistic first-job plan.",
    freeSupport: ["Employability self-check"],
    paidSupport: ["Internship/job-readiness roadmap", "Parent progress reviews"],
  },
];
