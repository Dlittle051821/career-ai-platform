import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SignatureHero } from "@/components/sections/home/signature/SignatureHero";
import { ProductEntryCards } from "@/components/sections/home/ProductEntryCards";
import { StudioIntro } from "@/components/sections/home/StudioIntro";
import { DiscoveryPillars } from "@/components/sections/home/DiscoveryPillars";
import { TrustedStudyExplorer } from "@/components/sections/home/TrustedStudyExplorer";
import { HowItWorks } from "@/components/sections/home/HowItWorks";
import { WhyNextwise } from "@/components/sections/home/WhyNextwise";
import { HomeFinalCTA } from "@/components/sections/home/HomeFinalCTA";
import { isHomepagePreviewEnabled } from "@/lib/home/signature-hero/variant";

/**
 * NW08.7 — local, development-only preview of the homepage with the
 * signature motion hero, for side-by-side comparison with `/`.
 *
 * Same sections, same order and same site layout (header, footer,
 * registration prompt) as src/app/(site)/page.tsx; only the hero differs,
 * plus a preview-only inspection bar. Answers 404 in every non-development
 * environment, is never indexed, and is linked from nowhere.
 */
export function generateMetadata(): Metadata {
  const robots = { index: false, follow: false, nocache: true };
  return isHomepagePreviewEnabled() ? { title: "Homepage preview", robots } : { robots };
}

export default function HomepagePreviewPage() {
  if (!isHomepagePreviewEnabled()) notFound();
  return (
    <>
      <SignatureHero devControls />
      <ProductEntryCards />
      <StudioIntro />
      <DiscoveryPillars />
      <TrustedStudyExplorer />
      <HowItWorks />
      <WhyNextwise />
      <HomeFinalCTA />
    </>
  );
}
