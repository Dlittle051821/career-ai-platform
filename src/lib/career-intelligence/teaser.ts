/**
 * Career Intelligence V2 — the free teaser contract.
 *
 * The ONLY shape of personalised output that may cross the unpaid boundary.
 * It is built on the server from the top result of the existing engine and
 * carries exactly the approved fields:
 *
 *   title, career family, the catalogue's general summary, ONE reason,
 *   and the career's licensed photo (or none, for the neutral tile).
 *
 * Never included: the fit band, the evidence level, any score, the other
 * reasons, gaps, matched signals, education routes, the rest of the ranking,
 * or how many careers were compared. `projectTeaser` copies field by field
 * from an explicit allow-list, so a new field added to RecommendationResult
 * can never leak through by accident.
 */
import { getCareerPhoto } from "@/lib/career-explorer/photos";
import type { RecommendationResult } from "@/lib/recommendations/types";

export interface CareerTeaserImage {
  src: string;
  alt: string;
  credit: string;
}

export interface CareerTeaser {
  /** "personal": from the student's own answers. "illustrative": a labelled example, shown only when a real teaser cannot be produced. */
  kind: "personal" | "illustrative";
  slug: string;
  title: string;
  familyName: string;
  summary: string;
  reason: string;
  image: CareerTeaserImage | null;
}

/** The allow-list. A test asserts the projected object has exactly these keys. */
export const TEASER_FIELDS = ["kind", "slug", "title", "familyName", "summary", "reason", "image"] as const;

function imageFor(slug: string): CareerTeaserImage | null {
  const photo = getCareerPhoto(slug);
  return photo ? { src: photo.src, alt: photo.alt, credit: `Photo: ${photo.creator}, ${photo.licence}` } : null;
}

export function projectTeaser(top: Pick<RecommendationResult, "slug" | "title" | "familyName" | "summary" | "reasons">): CareerTeaser | null {
  const reason = top.reasons.find((r) => r.label.trim().length > 0)?.label;
  if (!reason) return null;
  return {
    kind: "personal",
    slug: String(top.slug),
    title: String(top.title),
    familyName: String(top.familyName),
    summary: String(top.summary),
    reason: String(reason),
    image: imageFor(top.slug),
  };
}

/**
 * Shown, clearly labelled as an example, only when a personal teaser can't be
 * produced (the career library is unavailable, or nothing matched). Real
 * catalogue wording; nothing about it is claimed to be the student's result.
 */
export function illustrativeTeaser(): CareerTeaser {
  return {
    kind: "illustrative",
    slug: "robotics-engineer",
    title: "Robotics Engineer",
    familyName: "Engineering",
    summary: "Designs, builds, and programs robots and autonomous systems for use in manufacturing, logistics, healthcare, and other fields.",
    reason: "In a real preview, this line names the main reason the career appeared, taken from your own answers.",
    image: imageFor("robotics-engineer"),
  };
}
