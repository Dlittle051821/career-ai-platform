export interface PathwayCard {
  id: string;
  title: string;
  summary: string;
  points: string[];
}

export const PATHWAY_CARDS: PathwayCard[] = [
  {
    id: "india",
    title: "India",
    summary: "Often lower total cost with strong options concentrated in a few high-demand fields and institutes.",
    points: [
      "Wide range of course formats and institution types",
      "Lower average living and tuition cost than most abroad options",
      "Competitive entrance processes for top institutions",
      "Family proximity and familiar support systems",
    ],
  },
  {
    id: "europe",
    title: "Europe",
    summary: "Our initial international focus — a mix of tuition-friendly public systems and premium private options.",
    points: [
      "Wide variation in tuition depending on country and program",
      "Many programs taught in English at postgraduate level",
      "Work-while-studying rules vary significantly by country",
      "Visa and language requirements differ by destination",
    ],
  },
  {
    id: "other-international",
    title: "Other international options",
    summary: "Additional destinations some families consider; general immigration rules are not detailed in this milestone.",
    points: [
      "Costs and requirements vary widely by country",
      "Always verify current rules with official sources",
      "We will expand structured guidance here in later milestones",
    ],
  },
];

export const COURSE_SELECTION_CHECKLIST = [
  "Does this course lead toward the career direction I'm targeting?",
  "Is the course and institution properly recognised/accredited?",
  "What is the realistic total cost, including living expenses?",
  "What financing or scholarship options genuinely apply to me?",
  "What is the work exposure — internships, placements — during the course?",
  "What language and lifestyle adjustment does this require?",
  "What is my backup plan if this pathway doesn't work out?",
];

export const COST_CATEGORIES = [
  { label: "Tuition", note: "Varies widely by institution and country; confirm current figures directly with institutions." },
  { label: "Living cost", note: "Housing, food, and daily expenses — differs significantly by city." },
  { label: "Insurance", note: "Health and travel insurance, often mandatory for international study." },
  { label: "Travel", note: "Flights and periodic travel between India and the study destination." },
  { label: "Visa / application cost", note: "Visa fees, application fees, and standardised test costs." },
  { label: "Emergency buffer", note: "A financial cushion for unexpected costs — commonly overlooked in planning." },
  { label: "Financing cost", note: "Interest or fees if using an education loan to fund the pathway." },
];

export const COMPARISON_CRITERIA = [
  "Career fit",
  "Course duration",
  "Total cost",
  "Financing",
  "Work exposure",
  "Language and lifestyle",
  "Risk and backup plan",
];
