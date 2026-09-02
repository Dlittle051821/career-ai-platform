/**
 * Milestone 9 — the single, central event registry. No component or
 * server action anywhere in this codebase should ever hand-type a raw
 * event-name string — everything imports a name from `EVENT_NAMES` (or,
 * more usefully, from `IMPLEMENTED_EVENT_NAMES`) here instead. Mirrors the
 * `as const` array + derived union type convention already used for
 * catalog-style vocabularies elsewhere in this codebase (see e.g.
 * src/types/pricing.ts's `PRICING_CATEGORIES`).
 *
 * The `product_events_event_name_check` CHECK constraint in
 * supabase/migrations/0010_product_events_and_outcomes.sql PART 1 lists
 * this exact same set of names — that migration comment says so
 * explicitly, and says so again here: if a name is ever added, removed, or
 * renamed in this file, PART 1 of that migration (and a new, additive
 * migration after it ships) must be updated to match, or the database will
 * reject an event this file considers valid, or silently accept a name
 * this file no longer knows about.
 *
 * `status: "implemented"` means at least one real, already-working code
 * path in this application calls trackEvent() with that name today.
 * `status: "reserved"` means the name is defined so a future milestone (or
 * this one, once the underlying feature exists) can start firing it
 * without inventing a new name or touching the CHECK constraint again —
 * see each reserved event's own `reason` for exactly why it is not fired
 * yet. `docs/M9_EVENT_TAXONOMY.md` is the full human-readable write-up of
 * every entry below; this file is the type-checked source of truth for
 * the vocabulary that document describes.
 */

export type EventCategory =
  | "auth"
  | "profile"
  | "assessment"
  | "career"
  | "course"
  | "college"
  | "lead"
  | "commercial"
  | "outcome"
  | "agreement"
  | "onboarding"
  | "recommendation";

export interface EventDefinition {
  name: string;
  category: EventCategory;
  status: "implemented" | "reserved";
  /** One sentence: what real user/system action fires this, or why it is not fired yet. */
  reason: string;
}

export const PRODUCT_EVENTS = {
  // ---------------------------------------------------------------------
  // Auth / account
  // ---------------------------------------------------------------------
  user_registered: {
    name: "user_registered",
    category: "auth",
    status: "implemented",
    reason: "Fired from RegisterForm once supabase.auth.signUp() succeeds (src/components/sections/auth/RegisterForm.tsx).",
  },
  user_logged_in: {
    name: "user_logged_in",
    category: "auth",
    status: "reserved",
    reason: "LoginForm exists and works, but this event is deliberately out of this milestone's P0 instrumentation scope — reserved for a future pass.",
  },

  // ---------------------------------------------------------------------
  // Student profile
  // ---------------------------------------------------------------------
  profile_started: {
    name: "profile_started",
    category: "profile",
    status: "reserved",
    reason: "Out of this milestone's P0 scope — profile_completed (the transition that actually matters for the activation funnel) is implemented; the onboarding-started moment is not yet instrumented.",
  },
  profile_completed: {
    name: "profile_completed",
    category: "profile",
    status: "implemented",
    reason: "Fired from recomputeCompletion() (src/lib/supabase/student-profile-actions.ts) the moment a student's profile_status first transitions to 'completed'.",
  },

  // ---------------------------------------------------------------------
  // Assessment / quiz — RESERVED, no assessment/quiz feature exists.
  //
  // /career-discovery is an explicit, clearly-labelled MARKETING PREVIEW
  // page ("This page previews how future career discovery will work. It
  // does not run a live assessment yet.") — it computes nothing and stores
  // nothing. Real recommendation generation happens at /recommendations,
  // directly from the Student Digital Profile (career_recommendations_
  // generated, below) — that is this codebase's real equivalent of
  // "Assessment Completed" wherever the milestone spec's funnels reference
  // that name. These four names are defined here purely so a future
  // milestone that DOES build a real assessment/quiz UI can start firing
  // them without a schema change — no code in this repository ever calls
  // trackEvent() with any of them.
  // ---------------------------------------------------------------------
  assessment_started: {
    name: "assessment_started",
    category: "assessment",
    status: "reserved",
    reason: "No assessment/quiz feature exists in this codebase — /career-discovery is a static marketing preview page, not a live assessment.",
  },
  assessment_answered: {
    name: "assessment_answered",
    category: "assessment",
    status: "reserved",
    reason: "No assessment/quiz feature exists in this codebase.",
  },
  assessment_completed: {
    name: "assessment_completed",
    category: "assessment",
    status: "reserved",
    reason: "No assessment/quiz feature exists — see career_recommendations_generated for the real, working equivalent (recommendations generated from the Student Digital Profile).",
  },
  assessment_result_viewed: {
    name: "assessment_result_viewed",
    category: "assessment",
    status: "reserved",
    reason: "No assessment/quiz feature exists in this codebase.",
  },

  // ---------------------------------------------------------------------
  // Career discovery
  // ---------------------------------------------------------------------
  career_recommendations_generated: {
    name: "career_recommendations_generated",
    category: "career",
    status: "implemented",
    reason: "Fired from /recommendations (src/app/(site)/recommendations/page.tsx) after getRecommendations() computes results against the signed-in student's profile.",
  },
  career_viewed: {
    name: "career_viewed",
    category: "career",
    status: "implemented",
    reason: "Fired from /careers/[slug] (src/app/(site)/careers/[slug]/page.tsx) once a career is successfully resolved.",
  },
  career_compared: {
    name: "career_compared",
    category: "career",
    status: "implemented",
    reason: "Fired from /compare (src/app/(site)/compare/page.tsx) once 2-3 careers are resolved and the comparison table actually renders.",
  },
  career_saved: {
    name: "career_saved",
    category: "career",
    status: "reserved",
    reason: "education_saved_items.entity_type only supports 'university' and 'course' — there is no saved-career feature in this codebase yet.",
  },

  // ---------------------------------------------------------------------
  // Course discovery
  // ---------------------------------------------------------------------
  course_viewed: {
    name: "course_viewed",
    category: "course",
    status: "implemented",
    reason: "Fired from /courses/[universitySlug]/[courseSlug] once a course is successfully resolved.",
  },
  course_compared: {
    name: "course_compared",
    category: "course",
    status: "implemented",
    reason: "Fired from /courses/compare once 2+ courses are resolved and the comparison table actually renders.",
  },
  course_saved: {
    name: "course_saved",
    category: "course",
    status: "implemented",
    reason: "Fired from saveItem('course', ...) (src/lib/supabase/education/saved-items.ts) on a genuinely new save (not a repeat/idempotent one).",
  },
  application_started: {
    name: "application_started",
    category: "course",
    status: "implemented",
    reason: "Fired from startApplicationFromCourse() (src/lib/supabase/education/applications.ts) when a new applications row is actually inserted (not the 'already applied, reused existing row' branch).",
  },

  // ---------------------------------------------------------------------
  // College / university discovery
  // ---------------------------------------------------------------------
  college_viewed: {
    name: "college_viewed",
    category: "college",
    status: "implemented",
    reason: "Fired from /universities/[slug] once a university is successfully resolved.",
  },
  college_compared: {
    name: "college_compared",
    category: "college",
    status: "reserved",
    reason: "No university-vs-university comparison feature exists — this codebase has career comparison (career_compared, /compare) and course comparison (course_compared, /courses/compare) only.",
  },
  college_saved: {
    name: "college_saved",
    category: "college",
    status: "implemented",
    reason: "Fired from saveItem('university', ...) (src/lib/supabase/education/saved-items.ts) on a genuinely new save.",
  },

  // ---------------------------------------------------------------------
  // Lead / conversion
  // ---------------------------------------------------------------------
  lead_created: {
    name: "lead_created",
    category: "lead",
    status: "implemented",
    reason: "Fired from createLead() (src/lib/supabase/admin/leads.ts) — an admin/counsellor manually recording a lead in the CRM. There is no public self-service lead-capture submission path in this codebase (see counselling_requested).",
  },
  counselling_requested: {
    name: "counselling_requested",
    category: "lead",
    status: "reserved",
    reason: "The public /book-counselling form (BookingForm.tsx) is an explicit Milestone-1 demo — its own on-screen copy states submitted data 'was not transmitted, booked, or stored anywhere'. There is no real code path to instrument.",
  },

  // ---------------------------------------------------------------------
  // Commercial
  // ---------------------------------------------------------------------
  package_viewed: {
    name: "package_viewed",
    category: "commercial",
    status: "reserved",
    reason: "Already fully covered by pricing_analytics_events' 'plan_view' event (0007_nextwise_pricing_offers.sql PART 5, fired from src/app/(site)/pricing/page.tsx) — deliberately not duplicated into a second product_events row for the same page view. See docs/M9_IMPLEMENTATION.md.",
  },
  package_selected: {
    name: "package_selected",
    category: "commercial",
    status: "reserved",
    reason: "Already fully covered by pricing_analytics_events' 'plan_selected' event, fired from src/app/(site)/pricing/checkout/[slug]/page.tsx — deliberately not duplicated. See docs/M9_IMPLEMENTATION.md.",
  },
  payment_started: {
    name: "payment_started",
    category: "commercial",
    status: "implemented",
    reason: "Fired from createCheckoutSessionAction() (src/app/(site)/payments/actions.ts) once a Razorpay checkout session is created or reused.",
  },
  payment_completed: {
    name: "payment_completed",
    category: "commercial",
    status: "implemented",
    reason: "Fired from verifyCheckoutAction() (src/app/(site)/payments/actions.ts) once the browser's checkout signature is independently re-verified server-side — reflects checkout completion from the student's perspective; final settlement is confirmed asynchronously by the Razorpay webhook (apply_webhook_event), which has no user-facing call site to instrument.",
  },

  // ---------------------------------------------------------------------
  // Outcome
  // ---------------------------------------------------------------------
  offer_received: {
    name: "offer_received",
    category: "outcome",
    status: "reserved",
    reason: "Outcome-stage signals are reconstructed from applications/student_outcomes directly (see docs/OUT-001_OUTCOME_DATA_FOUNDATION.md) rather than duplicated as a product_events row — reserved for a future pass that wants an explicit event-stream signal here too.",
  },
  enrollment_confirmed: {
    name: "enrollment_confirmed",
    category: "outcome",
    status: "reserved",
    reason: "Same as offer_received — reconstructed from applications/student_outcomes, not yet duplicated into the event stream.",
  },

  // ---------------------------------------------------------------------
  // Milestone 10 — Electronic Signature Integration (F-122)
  // ---------------------------------------------------------------------
  agreement_signature_requested: {
    name: "agreement_signature_requested",
    category: "agreement",
    status: "implemented",
    reason: "Fired from sendForSignature() (src/lib/supabase/admin/signatures.ts) once a signature request has actually been created and sent to the provider.",
  },
  agreement_signature_viewed: {
    name: "agreement_signature_viewed",
    category: "agreement",
    status: "implemented",
    reason: "Fired from src/app/api/webhooks/signature/route.ts after a verified 'signature_request.viewed' webhook delivery is processed.",
  },
  agreement_signature_completed: {
    name: "agreement_signature_completed",
    category: "agreement",
    status: "implemented",
    reason: "Fired from src/app/api/webhooks/signature/route.ts after a verified 'signature_request.signed' webhook delivery is processed.",
  },
  agreement_signature_declined: {
    name: "agreement_signature_declined",
    category: "agreement",
    status: "implemented",
    reason: "Fired from src/app/api/webhooks/signature/route.ts after a verified 'signature_request.declined' webhook delivery is processed.",
  },
  agreement_signature_cancelled: {
    name: "agreement_signature_cancelled",
    category: "agreement",
    status: "implemented",
    reason: "Fired from cancelSignatureRequest() (src/lib/supabase/admin/signatures.ts) once an admin's explicit cancel action succeeds.",
  },

  // ---------------------------------------------------------------------
  // Milestone 11-A — Electronic Stamping (F-123)
  // ---------------------------------------------------------------------
  agreement_stamp_requested: {
    name: "agreement_stamp_requested",
    category: "agreement",
    status: "implemented",
    reason: "Fired from requestStamp() (src/lib/supabase/admin/stamping.ts) once a stamp request has actually been created and sent to the provider.",
  },
  agreement_stamp_completed: {
    name: "agreement_stamp_completed",
    category: "agreement",
    status: "implemented",
    reason: "Fired from src/app/api/webhooks/stamp/route.ts after a verified 'stamp_request.completed' webhook delivery is processed.",
  },
  agreement_stamp_failed: {
    name: "agreement_stamp_failed",
    category: "agreement",
    status: "implemented",
    reason: "Fired from src/app/api/webhooks/stamp/route.ts after a verified 'stamp_request.failed' webhook delivery is processed.",
  },
  agreement_stamp_cancelled: {
    name: "agreement_stamp_cancelled",
    category: "agreement",
    status: "implemented",
    reason: "Fired from cancelStampRequest() (src/lib/supabase/admin/stamping.ts) once an admin's explicit cancel action succeeds.",
  },

  // ---------------------------------------------------------------------
  // Milestone 11-B — Assisted Onboarding Revision. The product_events CHECK
  // constraint already accepts all six of these (0012 PART 6, ahead of the
  // code) — flipped to "implemented" as each real code path is built.
  // ---------------------------------------------------------------------
  onboarding_choice_viewed: {
    name: "onboarding_choice_viewed",
    category: "onboarding",
    status: "implemented",
    reason: "Fired from /welcome (src/app/(site)/welcome/page.tsx) — the post-registration Assisted Onboarding choice screen — on every render for a student who has not yet chosen a path.",
  },
  onboarding_discovery_selected: {
    name: "onboarding_discovery_selected",
    category: "onboarding",
    status: "implemented",
    reason: "Fired from recordOnboardingChoiceAction() (src/app/(site)/welcome/actions.ts) when the student picks \"Book a Free Discovery Session\".",
  },
  onboarding_self_profile_selected: {
    name: "onboarding_self_profile_selected",
    category: "onboarding",
    status: "implemented",
    reason: "Fired from recordOnboardingChoiceAction() (src/app/(site)/welcome/actions.ts) when the student picks \"Build My Profile Myself\".",
  },
  discovery_session_booked: {
    name: "discovery_session_booked",
    category: "onboarding",
    status: "implemented",
    reason: "Fired from bookDiscoverySession() (src/lib/supabase/discovery-sessions/book.ts) once a discovery_sessions row has actually been inserted.",
  },
  discovery_session_started: {
    name: "discovery_session_started",
    category: "onboarding",
    status: "implemented",
    reason: "Fired from saveDiscoverySessionWorkspace() (src/lib/supabase/admin/discovery-session-workspace.ts) the first time a counsellor saves the Discovery Session Counsellor Workspace for a session — never on later edits of the same session's workspace.",
  },
  discovery_session_completed: {
    name: "discovery_session_completed",
    category: "onboarding",
    status: "implemented",
    reason: "Fired from updateDiscoverySession() (src/lib/supabase/admin/discovery-sessions.ts) the moment a session's status is transitioned to 'completed' — the full Counsellor Workspace this fires alongside lands in M11-B2, but the status transition itself (and this event) is real as of M11-B1.",
  },

  // ---------------------------------------------------------------------
  // Milestone 11-C — Profile verification + recommendation readiness.
  // ---------------------------------------------------------------------
  profile_field_counsellor_updated: {
    name: "profile_field_counsellor_updated",
    category: "profile",
    status: "implemented",
    reason: "Fired from setSectionProvenance() (src/lib/supabase/admin/profile-provenance.ts) when a counsellor/admin records COUNSELLOR_ENTERED provenance for a Student Digital Profile section.",
  },
  profile_field_counsellor_verified: {
    name: "profile_field_counsellor_verified",
    category: "profile",
    status: "implemented",
    reason: "Fired from setSectionProvenance() (src/lib/supabase/admin/profile-provenance.ts) when a counsellor records COUNSELLOR_VERIFIED provenance for a Student Digital Profile section.",
  },
  profile_completeness_changed: {
    name: "profile_completeness_changed",
    category: "profile",
    status: "reserved",
    reason: "Same reasoning as recommendations_unlocked below: profile_completion_percent/status is deliberately computed fresh every time by calculateCompletion() (src/lib/profile/completion.ts), never diffed against a previous stored value, so there is no natural point to fire a 'changed' event from without adding state solely to support it. Left reserved.",
  },
  recommendation_readiness_changed: {
    name: "recommendation_readiness_changed",
    category: "recommendation",
    status: "implemented",
    reason: "Fired from setRecommendationVerification() and clearRecommendationVerification() (src/lib/supabase/admin/recommendation-readiness.ts) — the one genuine 'change' this pure-computed model can detect deterministically (an explicit counsellor override being set or cleared). The NOT_READY/PRELIMINARY/READY transitions that happen purely from a student editing their own profile are deliberately never persisted anywhere (see 0013 PART 5's table comment), so there is no stored 'previous value' to diff against and fire this event from there — only the stored override half of readiness is a real, event-worthy state change.",
  },
  recommendations_unlocked: {
    name: "recommendations_unlocked",
    category: "recommendation",
    status: "reserved",
    reason: "Would fire the first time a student's computed readiness crosses into READY, but Recommendation Readiness is deliberately a pure, computed-fresh-every-time value with no stored 'last known level' (0013 PART 5) — detecting that one-time crossing would require adding exactly the kind of stored state that design choice was meant to avoid. Left reserved rather than firing on every page load (which 'unlocked' would misrepresent) or inventing new persistence for this alone.",
  },
  personal_strategy_cta_viewed: {
    name: "personal_strategy_cta_viewed",
    category: "commercial",
    status: "reserved",
    reason: "The paid ₹5,000 'Personal Strategy' step named in the M11 spec has no concrete implementation anywhere in this codebase (no page, route, or product record — confirmed by search during M11-B investigation) — only the free Discovery Session (M11-B) and the general /pricing flow exist today. Building a new paid product page was out of this milestone's mandate (\"do not rebuild existing features or redesign unrelated pages\"); this stays reserved until that product actually exists to instrument.",
  },
  personal_strategy_selected: {
    name: "personal_strategy_selected",
    category: "commercial",
    status: "reserved",
    reason: "Same gap as personal_strategy_cta_viewed above — no real 'Personal Strategy' selection flow exists in this codebase yet.",
  },
} as const satisfies Record<string, EventDefinition>;

export type ProductEventName = keyof typeof PRODUCT_EVENTS;

export const EVENT_NAMES = Object.keys(PRODUCT_EVENTS) as ProductEventName[];

export const IMPLEMENTED_EVENT_NAMES = EVENT_NAMES.filter((name) => PRODUCT_EVENTS[name].status === "implemented");

/** The only names trackEvent() (src/lib/supabase/analytics/track.ts) will ever actually insert — calling it with a reserved or unknown name is dropped, logged, and never reaches Supabase. */
export type ImplementedEventName = (typeof IMPLEMENTED_EVENT_NAMES)[number];

export function isImplementedEventName(value: string): value is ImplementedEventName {
  return (IMPLEMENTED_EVENT_NAMES as string[]).includes(value);
}

/**
 * Entity types an event's `entity_id` can point at — matches
 * education_saved_items' own entity_type vocabulary plus the additional
 * entities this wider event log needs to reference. Kept as a plain
 * string union (not DB-CHECK-constrained — product_events.entity_type has
 * no CHECK, unlike event_name) since this column is descriptive metadata,
 * not itself a source of authorization or business logic.
 */
export const EVENT_ENTITY_TYPES = ["career", "course", "university", "lead", "application", "invoice", "plan", "profile", "agreement", "signature_request", "stamp_request", "discovery_session"] as const;
export type EventEntityType = (typeof EVENT_ENTITY_TYPES)[number];
