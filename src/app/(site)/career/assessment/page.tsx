import type { Metadata } from "next";
import { CiShell } from "@/components/career-intelligence/CiShell";
import { CareerAssessment } from "@/components/career-intelligence/CareerAssessment";
import { GuestAnswersTransfer } from "@/components/career-intelligence/GuestAnswersTransfer";
import { ASSESSMENT_SECTION_COUNT, answersFromSnapshot } from "@/lib/career-intelligence/assessment/model";
import { getStudentProfileSnapshot } from "@/lib/supabase/student-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Career Intelligence assessment",
  description: "The free Career Intelligence assessment: eight short sections about your strengths, interests and plans.",
  alternates: { canonical: "/career/assessment" },
  robots: { index: false, follow: true },
};

/**
 * Career Intelligence V2 — the free assessment. Open to everyone; no account
 * and no payment are needed. A signed-in student starts from what their
 * profile already holds and saves to it; a guest's progress stays on their
 * device until they create an account.
 */
export default async function CareerAssessmentPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section } = await searchParams;
  const requested = Number.parseInt(section ?? "", 10);
  const initialSection = Number.isInteger(requested) && requested >= 1 && requested <= ASSESSMENT_SECTION_COUNT ? requested - 1 : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const snapshot = user ? await getStudentProfileSnapshot() : null;

  return (
    <CiShell>
      {user ? <GuestAnswersTransfer /> : null}
      <CareerAssessment signedIn={Boolean(user)} initialAnswers={snapshot ? answersFromSnapshot(snapshot) : null} initialSection={initialSection} />
    </CiShell>
  );
}
