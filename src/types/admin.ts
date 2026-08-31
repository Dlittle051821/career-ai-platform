/**
 * Milestone 7 — domain types for the admin system. Mirrors the convention
 * established in src/types/student-profile.ts and src/types/career.ts:
 * these are the camelCase app-level shapes; the snake_case <-> camelCase
 * mapping lives only in src/lib/supabase/admin/*.ts (see those files'
 * docblocks).
 */

// ---------------------------------------------------------------------------
// Roles & permissions
// ---------------------------------------------------------------------------

export const ADMIN_ROLES = ["super_admin", "admin", "counsellor", "finance", "content_editor", "analyst"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  counsellor: "Counsellor",
  finance: "Finance",
  content_editor: "Content Editor",
  analyst: "Analyst",
};

/** The currently signed-in admin, as resolved server-side — never trust an equivalent value from the browser. */
export interface CurrentAdmin {
  userId: string;
  email: string | null;
  role: AdminRole;
  counsellorId: string | null;
}

// ---------------------------------------------------------------------------
// Counsellors
// ---------------------------------------------------------------------------

export interface Counsellor {
  id: string;
  userId: string | null;
  displayName: string;
  email: string | null;
  phone: string | null;
  specializations: string[];
  regions: string[];
  isActive: boolean;
  capacity: number | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CounsellorWorkload extends Counsellor {
  assignedStudentCount: number;
  assignedLeadCount: number;
  assignedApplicationCount: number;
}

// ---------------------------------------------------------------------------
// Universities & courses
// ---------------------------------------------------------------------------

export type AccreditationStatus = "unverified" | "self_reported" | "verified";
export const ACCREDITATION_STATUS_LABELS: Record<AccreditationStatus, string> = {
  unverified: "Unverified",
  self_reported: "Self-reported",
  verified: "Verified",
};

export interface University {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  city: string | null;
  website: string | null;
  institutionType: string | null;
  summary: string | null;
  accreditationStatus: AccreditationStatus;
  isActive: boolean;
  isVisible: boolean;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DeliveryMode = "on_campus" | "online" | "hybrid";
export type TuitionPeriod = "per_year" | "per_semester" | "per_program" | "per_credit";
export type CourseDataQualityStatus = "draft" | "reviewed" | "approved";

export interface Course {
  id: string;
  universityId: string;
  universityName: string;
  name: string;
  slug: string;
  educationLevel: string | null;
  fieldOfStudy: string | null;
  durationText: string | null;
  deliveryMode: DeliveryMode | null;
  campusLocation: string | null;
  intakeInfo: string | null;
  tuitionAmountMinorUnits: number | null;
  tuitionCurrency: string;
  tuitionPeriod: TuitionPeriod | null;
  entryRequirementsSummary: string | null;
  applicationUrl: string | null;
  isActive: boolean;
  isVisible: boolean;
  dataQualityStatus: CourseDataQualityStatus;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Students (admin view)
// ---------------------------------------------------------------------------

export type AdminStudentStatus = "prospect" | "active" | "inactive" | "archived";
export const ADMIN_STUDENT_STATUS_LABELS: Record<AdminStudentStatus, string> = {
  prospect: "Prospect",
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};

export interface AdminStudentSummary {
  userId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  status: AdminStudentStatus;
  assignedCounsellorId: string | null;
  assignedCounsellorName: string | null;
  profileCompletionPercent: number;
  createdAt: string;
}

export interface AdminStudentNote {
  id: string;
  studentUserId: string;
  authorUserId: string | null;
  authorName: string | null;
  note: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export type LeadStage = "new" | "contacted" | "qualified" | "nurturing" | "converted" | "lost";
export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  nurturing: "Nurturing",
  converted: "Converted",
  lost: "Lost",
};
export type LeadPriority = "low" | "medium" | "high";

export interface Lead {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  campaign: string | null;
  stage: LeadStage;
  priority: LeadPriority;
  assignedCounsellorId: string | null;
  assignedCounsellorName: string | null;
  nextFollowUpDate: string | null;
  lastContactDate: string | null;
  consentMarketing: boolean;
  notes: string | null;
  convertedStudentUserId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  landingPage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadStatusHistoryEntry {
  id: string;
  leadId: string;
  fromStage: LeadStage | null;
  toStage: LeadStage;
  changedBy: string | null;
  note: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export type ApplicationStage =
  | "inquiry"
  | "preparing"
  | "submitted"
  | "under_review"
  | "interview"
  | "decision_pending"
  | "offer_received"
  | "enrolled"
  | "rejected"
  | "withdrawn";

export const APPLICATION_STAGE_LABELS: Record<ApplicationStage, string> = {
  inquiry: "Inquiry",
  preparing: "Preparing",
  submitted: "Submitted",
  under_review: "Under review",
  interview: "Interview",
  decision_pending: "Decision pending",
  offer_received: "Offer received",
  enrolled: "Enrolled",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export type DecisionStatus = "pending" | "offer" | "waitlist" | "rejected" | "deferred";

export interface ApplicationDeadline {
  label: string;
  dueDate: string;
}

export interface Application {
  id: string;
  studentUserId: string;
  studentName: string | null;
  universityId: string | null;
  universityName: string | null;
  courseId: string | null;
  courseName: string | null;
  assignedCounsellorId: string | null;
  assignedCounsellorName: string | null;
  stage: ApplicationStage;
  intake: string | null;
  submissionDate: string | null;
  decisionStatus: DecisionStatus;
  offerType: string | null;
  deadlines: ApplicationDeadline[];
  nextAction: string | null;
  nextActionDate: string | null;
  lastContactDate: string | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationStatusHistoryEntry {
  id: string;
  applicationId: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string | null;
  note: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Payments — operational tracking only, never a processor. See
// docs/admin-system-guide.md §7.
// ---------------------------------------------------------------------------

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "partially_refunded" | "cancelled";
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  cancelled: "Cancelled",
};
export type RefundStatus = "none" | "requested" | "partial" | "full";

export interface Payment {
  id: string;
  studentUserId: string | null;
  studentName: string | null;
  applicationId: string | null;
  invoiceReference: string | null;
  amountMinorUnits: number;
  currency: string;
  paymentType: string | null;
  paymentMethodLabel: string | null;
  status: PaymentStatus;
  dueDate: string | null;
  paidDate: string | null;
  externalTransactionReference: string | null;
  refundStatus: RefundStatus;
  refundAmountMinorUnits: number | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Agreements
// ---------------------------------------------------------------------------

export type AgreementStatus = "draft" | "sent" | "signed" | "declined" | "expired" | "cancelled";
export type SignatureStatus = "not_started" | "pending_signature" | "signed";
export const SIGNATURE_STATUS_LABELS: Record<SignatureStatus, string> = {
  not_started: "Not started",
  pending_signature: "Pending signature",
  signed: "Signed",
};

export interface Agreement {
  id: string;
  agreementType: string;
  studentUserId: string | null;
  studentName: string | null;
  leadId: string | null;
  counsellorId: string | null;
  counsellorName: string | null;
  universityId: string | null;
  universityName: string | null;
  version: string | null;
  status: AgreementStatus;
  effectiveDate: string | null;
  expiryDate: string | null;
  documentReferenceUrl: string | null;
  signatureStatus: SignatureStatus;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Content management
// ---------------------------------------------------------------------------

export type ContentType = "faq" | "announcement" | "page_block";
export type ContentStatus = "draft" | "published" | "archived";

export interface ContentItem {
  id: string;
  contentType: ContentType;
  slug: string;
  contentKey: string | null;
  locale: string;
  title: string;
  body: string;
  status: ContentStatus;
  sortOrder: number;
  publishedAt: string | null;
  editorUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Conversion tracking
// ---------------------------------------------------------------------------

export interface ConversionEvent {
  id: string;
  leadId: string | null;
  studentUserId: string | null;
  eventName: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  landingPage: string | null;
  referralLabel: string | null;
  occurredAt: string;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  actorRole: AdminRole | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  changes: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Shared list-page shape
// ---------------------------------------------------------------------------

export interface AdminListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Milestone 9 — Student outcomes (student_outcomes,
// 0010_product_events_and_outcomes.sql PART 2). journey_stage and
// outcome_status intentionally share one vocabulary — see that migration's
// table comment and docs/OUT-001_OUTCOME_DATA_FOUNDATION.md for the
// distinction between the two columns.
// ---------------------------------------------------------------------------

export type OutcomeStage =
  | "not_started"
  | "exploring"
  | "shortlisted"
  | "application_started"
  | "application_submitted"
  | "offer_received"
  | "accepted"
  | "enrolled"
  | "not_enrolled"
  | "deferred"
  | "unknown";

export const OUTCOME_STAGE_LABELS: Record<OutcomeStage, string> = {
  not_started: "Not started",
  exploring: "Exploring",
  shortlisted: "Shortlisted",
  application_started: "Application started",
  application_submitted: "Application submitted",
  offer_received: "Offer received",
  accepted: "Accepted",
  enrolled: "Enrolled",
  not_enrolled: "Not enrolled",
  deferred: "Deferred",
  unknown: "Unknown",
};

export const OUTCOME_STAGES: OutcomeStage[] = [
  "not_started",
  "exploring",
  "shortlisted",
  "application_started",
  "application_submitted",
  "offer_received",
  "accepted",
  "enrolled",
  "not_enrolled",
  "deferred",
  "unknown",
];

export type OutcomeSource = "student" | "counsellor" | "admin" | "system" | "integration";

export interface StudentOutcome {
  id: string;
  studentUserId: string;
  journeyStage: OutcomeStage;
  outcomeStatus: OutcomeStage;
  targetCareerId: string | null;
  targetCourseId: string | null;
  targetUniversityId: string | null;
  finalApplicationId: string | null;
  destinationCountry: string | null;
  applicationCount: number;
  offerCount: number;
  finalDecisionStatus: string | null;
  outcomeSource: OutcomeSource;
  recordedBy: string | null;
  metadata: Record<string, unknown>;
  recordedAt: string;
  updatedAt: string;
}

/** Fields an admin/counsellor may set manually — never the application-derived fields (journeyStage/outcomeStatus/applicationCount/offerCount/finalDecisionStatus/finalApplicationId are kept current automatically by sync_student_outcome_from_application(), see the migration). */
export interface StudentOutcomeManualPatch {
  targetCareerId?: string | null;
  targetCourseId?: string | null;
  targetUniversityId?: string | null;
  destinationCountry?: string | null;
  metadata?: Record<string, unknown>;
  /** Only meaningful before an application exists — once one does, the trigger overwrites this on the next applications change. See docs/OUT-001_OUTCOME_DATA_FOUNDATION.md. */
  journeyStage?: OutcomeStage;
  outcomeStatus?: OutcomeStage;
}
