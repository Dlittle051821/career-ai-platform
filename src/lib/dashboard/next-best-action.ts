import type { MyAgreementSummary } from "@/lib/supabase/agreements/my-agreements";
import type { ProfileStatus } from "@/types/student-profile";
import type { RecommendationReadiness } from "@/types/recommendation-readiness";

export interface NextBestAction {
  title: string;
  description: string;
  href: string;
  cta: string;
}

export interface NextBestActionInput {
  profileStatus: ProfileStatus;
  profilePercent: number;
  payableInvoiceCount: number;
  pendingSignatureAgreement: MyAgreementSummary | undefined;
  careerReadiness: RecommendationReadiness | null;
  /**
   * NW01 Part F — whether `getRecommendations()` actually returned at
   * least one real career match right now, independent of
   * `careerReadiness.level`. Required before this module will ever say
   * "Your recommendations are ready" — readiness alone only reflects the
   * student's OWN profile completeness, not whether the career catalogue
   * currently has anything to recommend (the exact gap the original
   * catalogue outage exposed). Same signal journey-progress.ts now also
   * requires — see src/lib/dashboard/journey-progress.ts's docblock —
   * both callers pass the same real `getRecommendations()` result so
   * Dashboard and /recommendations can never disagree about this.
   */
  hasUsableCareerRecommendations: boolean;
  hasActiveDiscoverySession: boolean;
}

/**
 * UX01-02 — "Next Best Action" for the dashboard's Decision Dashboard
 * hierarchy: one obvious, prioritised action instead of a flat feature
 * grid. Every branch reads only real, already-fetched application state
 * (profile completion, payments, agreements, recommendation readiness,
 * Discovery Session) — nothing here is a hard-coded or fabricated claim,
 * and no stage is ever presented as complete unless the underlying data
 * says so. Order reflects the spec's priority: an incomplete profile (the
 * thing that unlocks everything else) outranks a payment or signature,
 * which outrank recommendation guidance, which outranks an optional
 * Discovery Session invitation, which falls back to free exploration.
 *
 * UX03/UX04 — extracted verbatim (same branches, same order, same copy)
 * from src/app/(site)/dashboard/page.tsx so it can be unit tested and so
 * the new Journey Progress component (src/lib/dashboard/journey-progress.ts)
 * can share its input shape instead of recomputing an overlapping "what's
 * next" answer. This is the ONE "what should I do next?" system on the
 * dashboard — Journey Progress is deliberately orientation-only (it shows
 * where the student stands across the six journey stages) and never
 * produces its own competing call-to-action text. See
 * docs/ux/UX03-04_DESIGN_SYSTEM_JOURNEY.md.
 */
export function getNextBestAction(args: NextBestActionInput): NextBestAction {
  const {
    profileStatus,
    profilePercent,
    payableInvoiceCount,
    pendingSignatureAgreement,
    careerReadiness,
    hasUsableCareerRecommendations,
    hasActiveDiscoverySession,
  } = args;

  if (profileStatus === "not_started") {
    return {
      title: "Start your Student Digital Profile",
      description: "A few minutes now unlocks personalised career recommendations and lets a counsellor pick up right where you left off.",
      href: "/profile/onboarding",
      cta: "Start my profile",
    };
  }

  if (profileStatus === "in_progress") {
    return {
      title: `Continue your Student Digital Profile — ${profilePercent}% complete`,
      description: "Pick up where you left off. The more you add, the more useful your recommendations become.",
      href: "/profile/onboarding",
      cta: "Continue my profile",
    };
  }

  if (payableInvoiceCount > 0) {
    return {
      title: "You have a payment due",
      description: `${payableInvoiceCount} invoice${payableInvoiceCount === 1 ? "" : "s"} awaiting payment.`,
      href: "/payments",
      cta: "View payments",
    };
  }

  if (pendingSignatureAgreement) {
    return {
      title: "An agreement is waiting for your signature",
      description: `${pendingSignatureAgreement.agreementType} needs your signature before work can continue.`,
      href: `/agreements/${pendingSignatureAgreement.id}`,
      cta: "Review & sign",
    };
  }

  if (careerReadiness && (careerReadiness.level === "NOT_READY" || careerReadiness.level === "PRELIMINARY") && careerReadiness.nextActions.length > 0) {
    return {
      title: "Your recommendations are almost ready",
      description: careerReadiness.nextActions.slice(0, 2).join(" "),
      href: "/recommendations",
      cta: "See what's needed",
    };
  }

  if (careerReadiness && (careerReadiness.level === "READY" || careerReadiness.level === "COUNSELLOR_VERIFIED")) {
    // NW01 Part F — readiness alone used to be treated as proof
    // recommendations exist; it only proves the STUDENT's profile is
    // ready. Only say "ready" when the engine actually produced a usable
    // result right now too.
    if (hasUsableCareerRecommendations) {
      return {
        title: "Your recommendations are ready",
        description: "Explore careers ranked against your Student Digital Profile, with plain-language reasons for each one.",
        href: "/recommendations",
        cta: "View my recommendations",
      };
    }

    return {
      title: "Your profile is ready, but we can't generate recommendations right now",
      description: "This is on our side, not yours — please check back shortly, or book a free Discovery Session to talk it through with a counsellor in the meantime.",
      href: hasActiveDiscoverySession ? "/recommendations" : "/discovery-session/book",
      cta: hasActiveDiscoverySession ? "Check recommendations" : "Book my free Discovery Session",
    };
  }

  if (!hasActiveDiscoverySession) {
    return {
      title: "Want to talk it through?",
      description: "Book a free, no-obligation Discovery Session with a counsellor — a good next step if you'd rather talk than fill in a form.",
      href: "/discovery-session/book",
      cta: "Book my free Discovery Session",
    };
  }

  return {
    title: "Keep exploring",
    description: "Browse careers, courses, and universities to find options worth comparing.",
    href: "/careers",
    cta: "Explore options",
  };
}
