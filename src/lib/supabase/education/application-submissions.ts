import "server-only";
import { createClient } from "../server";

/**
 * Milestone 19 — Application Submission Preparation & Manual Submission
 * Tracking. Student-facing read. Every read goes through
 * get_my_application_submission() (0021_application_submission_tracking.sql
 * PART 4) — this file never reads `application_submissions` directly;
 * there is no direct student RLS policy on that table at all, matching this
 * codebase's established "student access is RPC-only" convention for every
 * application-related table since Milestone 16 v3 (see
 * ./applications.ts / ./application-documents.ts's own header comments).
 */

export interface MyApplicationSubmission {
  id: string;
  applicationId: string;
  submittedAt: string;
  submissionMethod: string;
  /** Present only when staff intentionally recorded one — never fabricated. */
  externalReference: string | null;
  universityLabel: string | null;
  courseLabel: string | null;
  createdAt: string;
}

function logDbError(context: string, error: unknown) {
  console.error(`[education/application-submissions] ${context}:`, error);
}

/**
 * The logged-in student's own submission record for one of their own
 * applications, or `null` if none has been recorded yet, the caller is not
 * logged in, or the application id is not theirs. get_my_application_
 * submission() itself re-verifies `application.student_user_id = auth.uid()`
 * and its RETURNS TABLE structurally excludes submitted_by_user_id,
 * internal_note, external_url, and platform_name — this function has no
 * field for any of the four even if the RPC were ever widened by mistake.
 */
export async function getMyApplicationSubmission(applicationId: string): Promise<MyApplicationSubmission | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("get_my_application_submission", { p_application_id: applicationId });
  if (error) {
    logDbError("getMyApplicationSubmission", error);
    return null;
  }
  const row = (data ?? [])[0];
  if (!row) return null;

  return {
    id: row.id,
    applicationId: row.application_id,
    submittedAt: row.submitted_at,
    submissionMethod: row.submission_method,
    externalReference: row.external_reference,
    universityLabel: row.university_label,
    courseLabel: row.course_label,
    createdAt: row.created_at,
  };
}
