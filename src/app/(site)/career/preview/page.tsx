import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CiShell } from "@/components/career-intelligence/CiShell";
import { CareerPreview, type PreviewStatus } from "@/components/career-intelligence/CareerPreview";
import { glanceFromAnswers } from "@/lib/career-intelligence/assessment/glance";
import { NotFinishedYet } from "@/components/career-intelligence/AssessmentComplete";
import { GuestAnswersTransfer } from "@/components/career-intelligence/GuestAnswersTransfer";
import { canViewCareerIntelligence } from "@/lib/career-intelligence/access";
import { answersFromSnapshot, firstOpenSectionIndex, isAssessmentComplete } from "@/lib/career-intelligence/assessment/model";
import { getCareerIntelligencePlans } from "@/lib/career-intelligence/plans";
import { computeCareerTeaser } from "@/lib/career-intelligence/teaser-server";
import { getCareerIntelligenceAccess } from "@/lib/supabase/career-intelligence-access";
import { getStudentProfileSnapshot } from "@/lib/supabase/student-profile";

export const metadata: Metadata = {
  title: "Your free Career Intelligence preview",
  robots: { index: false, follow: false },
};

/**
 * Career Intelligence V2 — the free preview.
 *
 * A student who already has access is sent straight to their report: they
 * are never asked to pay again. Everyone else gets the teaser contract only
 * (computeCareerTeaser → CareerTeaser): for a signed-in student it is
 * computed here from the saved profile; for a guest the browser sends its
 * own answers to the teaser action. No other part of any result is computed
 * for, or sent to, this page.
 */
export default async function CareerPreviewPage() {
  const [access, plans] = await Promise.all([getCareerIntelligenceAccess(), getCareerIntelligencePlans()]);
  if (canViewCareerIntelligence(access)) redirect("/career/report");

  const verified = { ...plans.verified };
  const status: PreviewStatus = access === "payment_pending" || access === "revoked" || access === "expired" ? access : "none";

  if (access === "anonymous") {
    return (
      <CiShell>
        <CareerPreview signedIn={false} teaser={null} glance={null} status="none" verified={verified} alsoIncludedIn={plans.alsoIncludedIn} purchasesOpen={plans.purchasesOpen} />
      </CiShell>
    );
  }

  const snapshot = await getStudentProfileSnapshot();
  const answers = snapshot ? answersFromSnapshot(snapshot) : null;
  if (!snapshot || !answers || !isAssessmentComplete(answers)) {
    return (
      <CiShell>
        <GuestAnswersTransfer />
        <NotFinishedYet section={answers ? firstOpenSectionIndex(answers) : 0} />
      </CiShell>
    );
  }

  const teaser = await computeCareerTeaser(snapshot);
  return (
    <CiShell>
      <GuestAnswersTransfer />
      <CareerPreview signedIn teaser={teaser} glance={glanceFromAnswers(answers)} status={status} verified={verified} alsoIncludedIn={plans.alsoIncludedIn} purchasesOpen={plans.purchasesOpen} />
    </CiShell>
  );
}
