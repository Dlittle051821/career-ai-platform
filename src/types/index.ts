/**
 * Shared domain types for the NextWise Milestone 1 frontend.
 * Everything here is UI/config typing only — no backend/data-layer types yet.
 */

export type TrustStatus = "verified" | "pending" | "planned" | "sample";

export interface NavLink {
  label: string;
  href: string;
  description?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export type JourneyStageId =
  | "self-understanding"
  | "career-exploration"
  | "skills"
  | "course"
  | "india-abroad"
  | "university"
  | "finance"
  | "admission"
  | "visa"
  | "internship"
  | "job-readiness";

export interface JourneyStage {
  id: JourneyStageId;
  order: number;
  title: string;
  summary: string;
  freeSupport: string[];
  paidSupport: string[];
  parentInvolvement?: string;
}

export interface TrustItem {
  label: string;
  value: string;
  status: TrustStatus;
}

export interface TeamPlaceholder {
  roleTitle: string;
  status: TrustStatus;
  note: string;
}

export interface ContactPurpose {
  title: string;
  description: string;
  icon: "student" | "parent" | "partner" | "complaint";
}

/**
 * A student's profile record (Milestone 2). Mirrors the `profiles` table —
 * see supabase/migrations/0001_profiles.sql. Intentionally minimal:
 * education/career/skills fields are Milestone 3+.
 */
export interface Profile {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  marketingConsent: boolean;
  accountType: string;
  createdAt: string;
  updatedAt: string;
}
