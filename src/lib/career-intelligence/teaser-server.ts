import "server-only";
import { getRecommendations, hasMinimumProfileDataForRecommendations } from "@/lib/recommendations";
import { getCareersForMatching } from "@/lib/supabase/careers";
import type { StudentProfileSnapshot } from "@/types/student-profile";
import { illustrativeTeaser, projectTeaser, type CareerTeaser } from "./teaser";

/**
 * Career Intelligence V2 — the server-side teaser generator.
 *
 * Runs the existing recommendation engine, unchanged, over the given answers
 * and returns ONLY the teaser projection of the first result. The full
 * result list lives in this function's scope and is discarded; it is never
 * returned, logged, cached or passed to a component.
 *
 * This is separate from the protected report on purpose: the report pages
 * call getRecommendations() themselves behind requireCareerIntelligence(),
 * and nothing here widens what they show.
 *
 * Fails soft to the labelled illustrative example (never to an error page,
 * never to an unlabelled sample).
 */
export async function computeCareerTeaser(snapshot: StudentProfileSnapshot): Promise<CareerTeaser> {
  if (!hasMinimumProfileDataForRecommendations(snapshot)) return illustrativeTeaser();
  try {
    const careers = await getCareersForMatching();
    if (careers.length === 0) return illustrativeTeaser();
    const { results } = getRecommendations(snapshot, careers);
    const top = results[0];
    return (top && projectTeaser(top)) || illustrativeTeaser();
  } catch {
    // no answer content in the log, only that it happened
    console.error("[career-intelligence] teaser could not be computed");
    return illustrativeTeaser();
  }
}
