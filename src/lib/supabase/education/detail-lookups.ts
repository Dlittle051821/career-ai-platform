import "server-only";
import { cache } from "react";
import { lookupPublicUniversityBySlug } from "./universities";
import { lookupPublicCourseBySlugPair } from "./courses";

/**
 * CC-24 — request-scoped (React cache) public detail lookups.
 *
 * The university and course detail routes have a loading.tsx skeleton, so
 * their page renders inside a Suspense boundary and the HTTP status is
 * already sent (200) by the time the page could call notFound(). The
 * existence check therefore runs in each segment's layout.tsx, which
 * renders before that boundary and can still answer 404. Sharing one
 * cached lookup per request means the layout, generateMetadata and the
 * page together still make a single database round trip for the record.
 */
export const lookupPublicUniversityBySlugCached = cache(lookupPublicUniversityBySlug);
export const lookupPublicCourseBySlugPairCached = cache(lookupPublicCourseBySlugPair);
