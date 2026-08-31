"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveItem, removeSavedItem } from "@/lib/supabase/education/saved-items";
import { shareCourse } from "@/lib/supabase/education/shares";
import { recordIntakeInterest, removeIntakeInterest } from "@/lib/supabase/education/intake-interests";
import { startApplicationFromCourse } from "@/lib/supabase/education/applications";

/**
 * Server Actions backing the four student-facing controls on the public
 * course detail page (`/courses/[universitySlug]/[courseSlug]`). Every
 * function here re-derives the logged-in user itself via the underlying
 * src/lib/supabase/education/*.ts calls (middleware protects *pages*, not a
 * Server Action invoked directly — same convention as
 * src/app/(site)/universities/[slug]/actions.ts) and translates the
 * data-access layer's result into this page's own state shape.
 */

function coursePath(universitySlug: string, courseSlug: string): string {
  return `/courses/${universitySlug}/${courseSlug}`;
}

export interface ToggleSaveCourseResult {
  saved: boolean;
  error: string | null;
}

/** Toggles a course's saved state for the currently logged-in student. Mirrors toggleSaveUniversityAction's optimistic-toggle contract. */
export async function toggleSaveCourseAction(
  courseId: string,
  universitySlug: string,
  courseSlug: string,
  nextSaved: boolean,
): Promise<ToggleSaveCourseResult> {
  const result = nextSaved ? await saveItem("course", courseId) : await removeSavedItem("course", courseId);

  if (!result.success) {
    return { saved: !nextSaved, error: result.error ?? "Something went wrong. Please try again." };
  }

  revalidatePath(coursePath(universitySlug, courseSlug));
  return { saved: nextSaved, error: null };
}

export interface ToggleIntakeInterestResult {
  interested: boolean;
  error: string | null;
}

/** Toggles "track this intake" for one course_intakes row. */
export async function toggleIntakeInterestAction(
  courseIntakeId: string,
  universitySlug: string,
  courseSlug: string,
  nextInterested: boolean,
): Promise<ToggleIntakeInterestResult> {
  const result = nextInterested ? await recordIntakeInterest(courseIntakeId) : await removeIntakeInterest(courseIntakeId);

  if (!result.success) {
    return { interested: !nextInterested, error: result.error ?? "Something went wrong. Please try again." };
  }

  revalidatePath(coursePath(universitySlug, courseSlug));
  return { interested: nextInterested, error: null };
}

/**
 * Bound directly to a plain `<form action={shareCourseFormAction}>` (native
 * progressive-enhancement Server Action, no client JS required) — the
 * message textarea is optional, matching shareCourse()'s own signature. A
 * logged-out submit still resolves cleanly: shareCourse() returns a
 * friendly `success:false` rather than throwing, and since this form is
 * only ever rendered for a logged-in visitor (the page shows a "Log in to
 * share" link instead when logged out), that path is defense-in-depth only.
 */
export async function shareCourseFormAction(formData: FormData): Promise<void> {
  const courseId = String(formData.get("courseId") ?? "");
  const universitySlug = String(formData.get("universitySlug") ?? "");
  const courseSlug = String(formData.get("courseSlug") ?? "");
  const rawMessage = formData.get("message");
  const message = typeof rawMessage === "string" && rawMessage.trim() ? rawMessage : undefined;

  if (!courseId) return;
  await shareCourse(courseId, message);
  revalidatePath(coursePath(universitySlug, courseSlug));
}

/**
 * Bound directly to a plain `<form action={startApplicationFormAction}>`.
 * On success, redirects to `/applications` (built by a sibling agent) with
 * a `?started=1` flash flag; on failure, redirects back to this course page
 * with `?applyError=1` so the page can show a friendly inline message
 * instead of a blank failure. `redirect()` throws internally by design —
 * it is intentionally not wrapped in a try/catch here.
 */
export async function startApplicationFormAction(formData: FormData): Promise<void> {
  const courseId = String(formData.get("courseId") ?? "");
  const universityId = String(formData.get("universityId") ?? "");
  const universitySlug = String(formData.get("universitySlug") ?? "");
  const courseSlug = String(formData.get("courseSlug") ?? "");

  if (!courseId || !universityId) {
    redirect(`${coursePath(universitySlug, courseSlug)}?applyError=1`);
  }

  const result = await startApplicationFromCourse(courseId, universityId);
  if (!result.success) {
    redirect(`${coursePath(universitySlug, courseSlug)}?applyError=1`);
  }

  redirect("/applications?started=1");
}
