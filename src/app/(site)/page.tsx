import type { Metadata } from "next";
import { publicPageMetadata } from "@/config/seo";
import { NextwiseV54Home } from "@/components/sections/home/v54/NextwiseV54Home";

// V5.4 PRODUCTION HOMEPAGE — the approved V5.4 landing page (full-screen,
// chapter scrolling, the original N reveal and N-led story, organic question
// cards, Log in / Sign up). See docs/home-v5-4/IMPLEMENTATION.md.
//
// The previous homepage sections (HomeHero, SignatureHero, ProductEntryCards,
// StudioIntro, DiscoveryPillars, TrustedStudyExplorer, HowItWorks,
// WhyNextwise, HomeFinalCTA) are no longer rendered here. Their component
// files stay on disk, unreferenced, exactly as UX10A left the sections it
// superseded: src/config/site.test.ts asserts that some of them exist, and
// keeping them makes this release trivially revertible.
//
// Public search and sharing metadata are unchanged.
export const metadata: Metadata = publicPageMetadata(
  "/",
  "Career Guidance & Study Abroad",
  "Explore careers, compare courses and universities, and plan study in India or Europe. Start with a free discovery session with NextWise.",
);

export default function HomePage() {
  return <NextwiseV54Home />;
}
