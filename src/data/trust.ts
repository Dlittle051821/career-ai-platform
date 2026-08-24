import type { TeamPlaceholder, TrustItem } from "@/types";

export const COMPANY_VERIFICATION_ITEMS: TrustItem[] = [
  { label: "Legal entity name", value: "To be published after verification", status: "pending" },
  { label: "Registration number", value: "To be published after verification", status: "pending" },
  { label: "GST number", value: "To be published after verification", status: "pending" },
  { label: "Registered address", value: "To be published after verification", status: "pending" },
  { label: "Authorised representatives", value: "To be published after verification", status: "pending" },
];

export const TEAM_PLACEHOLDERS: TeamPlaceholder[] = [
  {
    roleTitle: "Founder / Director",
    status: "planned",
    note: "Verified name, photograph, and credentials will be published once confirmed by the business owner.",
  },
  {
    roleTitle: "Lead Career Counsellor",
    status: "planned",
    note: "Counsellor credentials will be listed here after verification, including qualifications and experience.",
  },
  {
    roleTitle: "Admissions & Visa Advisor",
    status: "planned",
    note: "Role scope and verified background will be added once the position is filled and confirmed.",
  },
];

export const PAYMENT_PROTECTION_STEPS = [
  {
    title: "Written service scope before payment",
    description: "You receive a clear description of what is included before any money changes hands.",
  },
  {
    title: "Itemised invoice and receipt",
    description: "Every payment is mapped to a specific package and its deliverables.",
  },
  {
    title: "Refund and cancellation conditions shared upfront",
    description: "Conditions are shared and confirmed before payment, not discovered afterward.",
  },
  {
    title: "Secure payment provider (planned)",
    description: "A recognised, secure payment gateway is planned for future milestones; none is active yet.",
  },
];

export const WE_PROMISE = [
  "Transparent recommendations, including India and abroad options compared on merit.",
  "Clear, jargon-free communication with students and parents.",
  "Documented scope for every paid engagement.",
  "Respect for student data — collected minimally and used only for the purpose explained to you.",
  "Disclosure of relevant commercial relationships that could affect a recommendation.",
];

export const WE_NEVER_PROMISE = [
  "Guaranteed admission to any institution.",
  "Guaranteed scholarship or financial aid.",
  "Guaranteed visa approval.",
  "Guaranteed internship or job placement.",
  "Fabricated rankings, statistics, or outcome claims.",
];

export const APPLICATION_STATUS_PREVIEW = [
  "Planned",
  "Documents pending",
  "Submitted",
  "Institution response",
  "Decision",
];

export const ESCALATION_STEPS = [
  { step: "1. Counsellor", description: "Raise the concern directly with your assigned counsellor first." },
  { step: "2. Service manager", description: "If unresolved, the service manager reviews and responds in writing." },
  {
    step: "3. Formal grievance contact",
    description: "A dedicated grievance contact will be published once verified — see Contact for current placeholders.",
  },
];

export const DATA_PROTECTION_PRINCIPLES = [
  "Data minimisation — we intend to collect only what is needed for the purpose explained to you.",
  "Consent — clear consent is requested before any follow-up contact.",
  "Controlled access — only relevant team members would access student records.",
  "Deletion on request — a process for requesting data deletion is planned; contact us to ask about your data.",
];
