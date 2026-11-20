import type { Metadata } from "next";
import { CiShell } from "@/components/career-intelligence/CiShell";
import { PlanChooser } from "@/components/career-intelligence/PlanChooser";
import { GuestAnswersTransfer } from "@/components/career-intelligence/GuestAnswersTransfer";
import { canViewCareerIntelligence } from "@/lib/career-intelligence/access";
import { answersFromSnapshot, isAssessmentComplete } from "@/lib/career-intelligence/assessment/model";
import { getCareerIntelligencePlans } from "@/lib/career-intelligence/plans";
import { getCareerIntelligenceAccess } from "@/lib/supabase/career-intelligence-access";
import { getStudentProfileSnapshot } from "@/lib/supabase/student-profile";
import { planHasCapability } from "@/config/plan-capabilities";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Plans that include Career Intelligence",
  description: "Nextwise plans that include the full Career Intelligence report: Nextwise Verified and the Nextwise Study Abroad plans.",
  alternates: { canonical: "/career/plans" },
  robots: { index: false, follow: true },
};

/**
 * Career Intelligence V2 — plan selection. A student who already has access
 * is told so and sent to the report, never offered a second purchase.
 */
export default async function CareerPlansPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  const [access, catalogue] = await Promise.all([getCareerIntelligenceAccess(), getCareerIntelligencePlans()]);
  const signedIn = access !== "anonymous";

  if (canViewCareerIntelligence(access)) {
    return (
      <CiShell>
        <section className="status-card wrap">
          <span className="eyebrow">Career Intelligence</span>
          <h1 className="display">Your Career Intelligence is already unlocked.</h1>
          <p>Your plan includes the full report. There is nothing more to buy, and nothing to repeat.</p>
          <div className="actions">
            <Link className="btn btn-primary" href="/career/report">
              Open my report <ArrowRight className="icon" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </CiShell>
    );
  }

  let completeOnAccount = false;
  if (signedIn) {
    const snapshot = await getStudentProfileSnapshot();
    completeOnAccount = snapshot ? isAssessmentComplete(answersFromSnapshot(snapshot)) : false;
  }
  const initialPlan = plan && planHasCapability(plan, "career_intelligence") ? plan : null;

  return (
    <CiShell>
      {signedIn ? <GuestAnswersTransfer /> : null}
      <PlanChooser catalogue={catalogue} signedIn={signedIn} assessmentCompleteOnAccount={completeOnAccount} initialPlan={initialPlan} />
    </CiShell>
  );
}
