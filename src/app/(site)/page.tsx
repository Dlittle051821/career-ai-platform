import type { Metadata } from "next";
import { HomeHero } from "@/components/sections/home/HomeHero";
import { DiscoveryPillars } from "@/components/sections/home/DiscoveryPillars";
import { TrustedStudyExplorer } from "@/components/sections/home/TrustedStudyExplorer";
import { HowItWorks } from "@/components/sections/home/HowItWorks";
import { WhyNextwise } from "@/components/sections/home/WhyNextwise";
import { HomeFinalCTA } from "@/components/sections/home/HomeFinalCTA";

// M17A Step 5 — self-referencing canonical only. Title/description are
// deliberately left untouched (still inherited from the layout's
// DEFAULT_TITLE/BRAND_SHORT_DESCRIPTION) — this step does not rewrite copy.
//
// UX10A — the homepage's section COMPOSITION below was rebuilt to match
// the approved premium-homepage reference image's own six-section
// structure (Hero / Discovery Pillars / Trusted Study Explorer / How It
// Works / Why Nextwise / Final CTA) end to end, replacing the prior
// ad-hoc section list (DecisionProblems/CareerJourneyPreview/
// StudentParentSplit/IndiaAbroadPreview/TrustPreview/HowSupportWorks/
// PricingPreview/HomeFaq/CTASection).
//
// UX10-H04 "EXACT MATCH TO FINAL APPROVED HOMEPAGE MOCKUP" — AnnouncementStrip
// is no longer rendered on the homepage. This milestone's own final
// reference shows a clean header with no navy announcement bar beneath it,
// and its brief explicitly permits removing (or subtly integrating) that
// bar "if not product-critical." Its message (Odisha career-first
// positioning) is marketing copy, not functional/critical to the page, so
// it's removed here rather than force-fit into the reference's clean
// header — the same judgment call this milestone's brief asks for. The
// component file itself is deliberately left on disk, unreferenced, same
// as the nine superseded section files below — nothing imports it outside
// this file, and deleting it is not necessary to satisfy either
// milestone's brief.
//
// The nine superseded section COMPONENT FILES themselves are deliberately
// NOT deleted from src/components/sections/home/ even though nothing
// imports them anymore: src/config/site.test.ts's own rebrand regression
// guard asserts (by exact relative path) that both
// src/components/sections/home/Hero.tsx and .../PricingPreview.tsx exist
// on disk and do not mention the old brand name. Deleting either file
// would fail that pre-existing test, which this milestone's own
// instruction ("Preserve all existing tests") does not permit working
// around. See docs/ux10a-premium-homepage-design-system.md for the full
// reasoning and the complete list of files left in place unreferenced.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <DiscoveryPillars />
      <TrustedStudyExplorer />
      <HowItWorks />
      <WhyNextwise />
      <HomeFinalCTA />
    </>
  );
}
