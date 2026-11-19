/**
 * NW-PRICING-V3 — presentation copy for the pricing page: stage labels, the
 * comparison grid, scope statements and FAQs. It holds NO prices, quantities
 * that are sold, or plan names: those come from the live catalogue
 * (catalogue.ts) so there is one pricing source of truth. Values in the grid
 * describe the published inclusions of each plan in a comparable form; the
 * test suite checks them against the catalogue migration.
 */
import type { V3PlanSlug } from "./quote";

export const V3_STAGE: Record<V3PlanSlug, { stage: string; ideal: string }> = {
  "nextwise-verified": { stage: "Know your direction", ideal: "For students who need clarity before choosing their next direction." },
  "study-abroad-lite": { stage: "Apply with structure", ideal: "Structured study-abroad support, from profile review to settling in." },
  "study-abroad-premium": { stage: "Go further, with priority", ideal: "Comprehensive study-abroad planning with deeper strategy and priority support." },
};

/** Cell: true = included, false = not included, string = included with this scope. */
export type CompareCell = boolean | string;
export interface CompareRow {
  label: string;
  note?: string;
  cells: Record<V3PlanSlug, CompareCell>;
}
export interface CompareGroup {
  title: string;
  rows: CompareRow[];
}

const row = (label: string, verified: CompareCell, lite: CompareCell, premium: CompareCell, note?: string): CompareRow => ({
  label,
  note,
  cells: { "nextwise-verified": verified, "study-abroad-lite": lite, "study-abroad-premium": premium },
});

export const V3_COMPARISON: CompareGroup[] = [
  {
    title: "Career and profile evaluation",
    rows: [
      row("Career Intelligence report", true, true, true),
      row("Academic profile and eligibility screening", true, "Detailed, academic and professional", "Comprehensive, academic and professional"),
      row("Education-pathway assessment", true, true, true),
      row("Profile-building and improvement plan", false, false, true),
    ],
  },
  {
    title: "University research and shortlisting",
    rows: [
      row("Course or programme recommendations", "Up to 3 researched", "Within your shortlist", "Within your shortlist"),
      row("Country and course selection guidance", "Limited exploration", true, true),
      row("University shortlist", false, "Up to 5", "Up to 10"),
      row("Admission-readiness review", "Requirements and skill-gap checklist", "Qualitative review", "Detailed review with gap identification", "A qualitative assessment, never a guaranteed probability."),
    ],
  },
  {
    title: "Applications",
    rows: [
      row("University application assistance", false, "Up to 5 universities", "Up to 10 universities"),
      row("Additional universities", false, "Can be added", "Can be added", "Each additional university is priced on the card above."),
      row("Deadline tracking and document review", false, true, "With quality assurance"),
    ],
  },
  {
    title: "CV, SOP, essays and LOR",
    rows: [
      row("CV", false, "Creation and polishing", "Professional creation and assessment"),
      row("Statement of Purpose (SOP)", false, "Complete support", "Development with up to 3 review rounds"),
      row("Essays and supplementary questions", false, "Guidance", "Review"),
      row("Letters of recommendation", false, "Assistance", "Strategy and assistance"),
    ],
  },
  {
    title: "Scholarships",
    rows: [
      row("Scholarship screening", "Initial screening", "Guidance on applicable opportunities", "Eligibility screening and document support"),
      row("Scholarship-application assistance", false, false, "Up to 5 opportunities"),
    ],
  },
  {
    title: "Interviews",
    rows: [row("Mock interviews with feedback", false, false, "Up to 3")],
  },
  {
    title: "Counsellor and mentor sessions",
    rows: [
      row("Counsellor", "Expert clarification session", "Senior dedicated counsellor", "Senior dedicated counsellor"),
      row("Mentor sessions", false, "Included", "Lite's sessions, plus 2 more", "The number of Lite mentor sessions is set out in your agreement."),
      row("Revision of your guidance", "One revision", false, false),
    ],
  },
  {
    title: "Visa, finance and accommodation",
    rows: [
      row("Study-cost and affordability", "Snapshot", "Scholarship and affordability guidance", "Offer, scholarship and total-cost comparison"),
      row("Visa documents", false, "Guidance", "Guidance and coordination", "Visa decisions are made by the relevant authorities."),
      row("Education loan", false, "Information and coordination", "Coordination"),
      row("Accommodation and pre-departure", false, true, true),
    ],
  },
  {
    title: "After arrival and priority support",
    rows: [
      row("Settling-in guidance", false, "Up to 6 months", "Within the programme scope"),
      row("Parent progress meeting", false, false, true),
      row("Priority email and WhatsApp support", false, false, "Up to 12 months", "During working hours; not a 24/7 service."),
    ],
  },
];

export const V3_SCOPE = [
  { title: "Admission isn't guaranteed", text: "Universities decide admissions. We help you prepare the strongest application we can." },
  { title: "Scholarships aren't guaranteed", text: "Awards are decided by the scholarship provider, not by Nextwise." },
  { title: "Visas are decided by the authorities", text: "We guide your documents; the decision belongs to the relevant immigration authority." },
  { title: "Third-party fees are separate", text: "Application, university, visa, translation, examination and travel fees are paid by you where they apply." },
  { title: "Your agreement defines the service", text: "What each package includes is set out in your Nextwise agreement before you pay." },
  { title: "Official sources come first", text: "University and government websites remain the authority on requirements, fees and deadlines." },
];

export const V3_FAQS = [
  {
    question: "Which plan should I choose?",
    answer:
      "Choose Nextwise Verified if you are still deciding what to study or where your career is heading. Choose Study Abroad Lite when you know you want to study abroad and need structured help applying to up to five universities. Choose Premium for up to ten universities with deeper strategy, scholarship applications, mock interviews and priority support.",
  },
  {
    question: "Can I add more universities later?",
    answer:
      "You can choose additional universities on this page with Study Abroad Lite or Premium. If you want to add universities after you have enrolled, talk to your counsellor, who will confirm it in writing.",
  },
  {
    question: "What does each additional university cover?",
    answer:
      "Application assistance for one more university, within the same service scope your package gives the universities it includes. It does not cover that university's own application fee.",
  },
  {
    question: "Does Nextwise Verified include application assistance?",
    answer:
      "No. Verified is about clarity: your Career Intelligence report, eligibility and pathway assessment, up to three researched programme recommendations and a short expert session. Application support starts with Study Abroad Lite.",
  },
  {
    question: "Are application and visa fees included?",
    answer: "No. University application fees, visa fees, translations, examinations, travel and other third-party charges are paid separately by you where they apply.",
  },
  {
    question: "What happens after I choose a package?",
    answer:
      "Online payment isn't open yet. Book a free session and a Nextwise counsellor will go through your package with you, confirm it in an agreement and explain how to pay. Your choice is kept so you don't need to start again.",
  },
  {
    question: "Can I upgrade later?",
    answer: "Yes, you can move to a larger package by talking to your counsellor. How anything you have already paid is treated is confirmed with you in writing at that time.",
  },
  {
    question: "I bought an earlier Nextwise plan. What happens to it?",
    answer:
      "Nothing changes for you. Plans that are no longer sold keep everything you paid for, including your access, invoices and agreement. You will not be asked to pay again because the plans on this page have changed.",
  },
];
