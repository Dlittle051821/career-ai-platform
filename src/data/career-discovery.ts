export interface DiscoveryFactor {
  label: string;
  weight: number;
  description: string;
}

export const DISCOVERY_FACTORS: DiscoveryFactor[] = [
  { label: "Interests", weight: 25, description: "What genuinely holds your attention and curiosity." },
  { label: "Academics", weight: 15, description: "Subjects and streams where you've shown consistent strength." },
  { label: "Skills", weight: 15, description: "Abilities you already have or are close to developing." },
  { label: "Work style", weight: 15, description: "How you prefer to work — independently, in teams, structured or flexible." },
  { label: "Priorities", weight: 10, description: "What matters most to you — stability, growth, impact, income." },
  { label: "Education preferences", weight: 10, description: "Preferred course formats, duration, and learning style." },
  { label: "Geography and lifestyle", weight: 5, description: "Where you're open to living and studying." },
  { label: "Feasibility", weight: 5, description: "Realistic constraints — budget, timeline, eligibility." },
];

export interface SampleQuestion {
  prompt: string;
  type: "scale" | "choice";
  options?: string[];
}

export const SAMPLE_QUESTIONS: SampleQuestion[] = [
  {
    prompt: "I enjoy figuring out how things work by taking them apart or experimenting.",
    type: "scale",
  },
  {
    prompt: "When working on a group project, I usually prefer to:",
    type: "choice",
    options: ["Lead and organise the plan", "Focus on one part deeply", "Support wherever needed", "Work mostly alone, then share"],
  },
  {
    prompt: "A subject I could talk about for an hour without getting bored is...",
    type: "choice",
    options: ["Science and how things work", "Numbers, logic and patterns", "People, culture and communication", "Design, art or creativity"],
  },
  {
    prompt: "I would rather have a job with a predictable routine than one that changes every day.",
    type: "scale",
  },
];

export const SAMPLE_RESULT = {
  label: "Illustrative career direction",
  title: "Applied Technology & Product Roles",
  description:
    "This is a sample output shown purely to illustrate the format future results will take. It is not based on real answers and should not be treated as guidance.",
  matchFactors: ["Strong analytical interest", "Comfortable with structured problem-solving", "Prefers hands-on work"],
};
