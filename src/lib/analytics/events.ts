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
  | "agreement";

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
export const EVENT_ENTITY_TYPES = ["career", "course", "university", "lead", "application", "invoice", "plan", "profile", "agreement", "signature_request"] as const;
export type EventEntityType = (typeof EVENT_ENTITY_TYPES)[number];
