import type { Metadata } from "next";
import { AnnouncementStrip } from "@/components/sections/home/AnnouncementStrip";
import { Hero } from "@/components/sections/home/Hero";
import { DecisionProblems } from "@/components/sections/home/DecisionProblems";
import { CareerJourneyPreview } from "@/components/sections/home/CareerJourneyPreview";
import { StudentParentSplit } from "@/components/sections/home/StudentParentSplit";
import { IndiaAbroadPreview } from "@/components/sections/home/IndiaAbroadPreview";
import { TrustPreview } from "@/components/sections/home/TrustPreview";
import { HowSupportWorks } from "@/components/sections/home/HowSupportWorks";
import { PricingPreview } from "@/components/sections/home/PricingPreview";
import { HomeFaq } from "@/components/sections/home/HomeFaq";
import { CTASection } from "@/components/sections/CTASection";

// M17A Step 5 — self-referencing canonical only. Title/description are
// deliberately left untouched (still inherited from the layout's
// DEFAULT_TITLE/BRAND_SHORT_DESCRIPTION) — this step does not rewrite copy.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <AnnouncementStrip />
      <Hero />
      <DecisionProblems />
      <CareerJourneyPreview />
      <StudentParentSplit />
      <IndiaAbroadPreview />
      <TrustPreview />
      <HowSupportWorks />
      <PricingPreview />
      <HomeFaq />
      <CTASection />
    </>
  );
}
