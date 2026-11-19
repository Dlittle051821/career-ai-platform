import type { Metadata } from "next";
import { CiShell } from "@/components/career-intelligence/CiShell";
import { AssessmentCompleteView, GuestCompletion, NotFinishedYet } from "@/components/career-intelligence/AssessmentComplete";
import { GuestAnswersTransfer } from "@/components/career-intelligence/GuestAnswersTransfer";
import { answersFromSnapshot, firstOpenSectionIndex, isAssessmentComplete } from "@/lib/career-intelligence/assessment/model";
import { getStudentProfileSnapshot } from "@/lib/supabase/student-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Assessment complete",
  robots: { index: false, follow: false },
};

/**
 * Career Intelligence V2 — the completion screen. For a signed-in student the
 * server confirms the saved profile really answers all eight sections before
 * saying so; for a guest the device copy is checked in the browser.
 */
export default async function AssessmentCompletePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <CiShell navy>
        <GuestCompletion />
      </CiShell>
    );
  }
  const snapshot = await getStudentProfileSnapshot();
  const answers = snapshot ? answersFromSnapshot(snapshot) : null;
  const complete = answers ? isAssessmentComplete(answers) : false;
  return (
    <CiShell navy={complete}>
      <GuestAnswersTransfer />
      {complete ? <AssessmentCompleteView savedTo="account" /> : <NotFinishedYet section={answers ? firstOpenSectionIndex(answers) : 0} />}
    </CiShell>
  );
}
