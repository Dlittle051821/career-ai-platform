/**
 * NW08.7 — which hero the homepage renders, and whether the side-by-side
 * preview route exists.
 *
 * NW-V4 note: `/` now renders the V4 Connected Experience directly
 * (src/components/sections/home/v4/V4ConnectedHome.tsx) and no longer reads
 * NEXTWISE_HOMEPAGE_HERO. The variants below remain available to the
 * development-only preview routes.
 *
 * `/` keeps the current approved hero (HomeHero) unless the server-side
 * environment variable NEXTWISE_HOMEPAGE_HERO is exactly "signature" (the
 * scroll-driven ribbon) or "film" (the interactive ribbon story, FilmHero). It
 * is not a NEXT_PUBLIC_ variable, is not set anywhere in this repository,
 * and nothing in production sets it — so deploying this code changes
 * nothing on the live homepage until someone deliberately opts in. Because
 * the homepage is statically rendered, the value is read at build time:
 * changing it requires a rebuild.
 *
 * `/homepage-preview` renders the full homepage with the signature hero
 * (and a preview-only dev bar) for local side-by-side comparison with `/`.
 * `/homepage-preview/film` does the same with the interactive ribbon story
 * hero (FilmHero), selected on `/` by NEXTWISE_HOMEPAGE_HERO="film".
 * Both preview routes exist only in development and test; every other environment answers
 * 404 — the same rule as the Motion Lab (src/lib/motion-lab/guard.ts).
 */

export type HomepageHeroVariant = "current" | "signature" | "film";

export const HOMEPAGE_HERO_ENV = "NEXTWISE_HOMEPAGE_HERO";

export function getHomepageHeroVariant(value: string | undefined = process.env[HOMEPAGE_HERO_ENV]): HomepageHeroVariant {
  if (value === "signature" || value === "film") return value;
  return "current";
}

export function isHomepagePreviewEnabled(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv === "development" || nodeEnv === "test";
}
