import type { Metadata } from "next";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CTASection } from "@/components/sections/CTASection";
import { FaqAccordion } from "@/components/sections/FaqAccordion";
import { HowItWorksHero } from "@/components/sections/how-it-works/HowItWorksHero";
import { JourneyStepFlow } from "@/components/sections/how-it-works/JourneyStepFlow";
import { StudyPathwaysSection } from "@/components/sections/how-it-works/StudyPathwaysSection";
import { WhyChooseStrip } from "@/components/sections/how-it-works/WhyChooseStrip";
import { HOME_FAQS } from "@/data/faqs";

/**
 * UX10-HW01 "How It Works Redesign" — rebuilt to match the approved
 * three-part reference image (center = target design; left = the old page
 * being replaced, kept only for context; right = annotation boxes
 * explaining intent, never reproduced as literal UI). See
 * UX10-HW01_REFERENCE_AUDIT.md for the full section-by-section comparison
 * and every documented interpretation decision.
 *
 * Section order follows the reference's own 5 annotated sections exactly:
 * hero -> 5-step journey -> dual pathway -> trust/value strip -> final
 * CTA. The old page's FAQ is kept (reusing the same real HOME_FAQS data,
 * unchanged) as a closing section before the CTA, matching the sitewide
 * convention of every other public page (Home, Pricing, Study Options,
 * About) — dropping it entirely would be a regression, not a simplification,
 * and the reference image doesn't show anything in that slot it would
 * conflict with. The old "Tech vs Human" and "What we ask you to provide /
 * Honest limitations" sections are retired in favour of the reference's
 * own 5-step flow and dual-pathway section, which now cover that same
 * ground more visually — their honesty-disclosure spirit (see the old
 * page's `DemoNotice`) is preserved via a new `DemoNotice` inside
 * `StudyPathwaysSection` instead of a dedicated two-column section.
 */
export const metadata: Metadata = {
  title: "How It Works",
  description:
    "A simple, personalised journey from your goals to the right opportunity — across India and our early international focus on Europe. See the 5-step process, free vs. paid support, and the two pathways we guide you through.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return (
    <>
      <HowItWorksHero />

      <Section tone="surface">
        <SectionHeading
          eyebrow="Your Nextwise journey"
          title="A clear 5-step journey"
          description="From exploring options to starting your next chapter, we guide you at every step."
          titleClassName="font-sans text-text"
          align="center"
          className="mx-auto max-w-2xl"
        />
        <div className="mt-10">
          <JourneyStepFlow />
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="Two pathways, one goal"
          title="Choose your pathway"
          description="Whichever direction fits your goals and budget, the same honest, step-by-step guidance applies."
          titleClassName="font-sans text-text"
          align="center"
          className="mx-auto max-w-2xl"
        />
        <div className="mt-10">
          <StudyPathwaysSection />
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeading
          eyebrow="Why students & parents choose Nextwise"
          title="Guidance you can actually trust"
          titleClassName="font-sans text-text"
          align="center"
          className="mx-auto max-w-2xl"
        />
        <div className="mt-10">
          <WhyChooseStrip />
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="Questions" title="Frequently asked questions" align="center" className="mx-auto" />
        <div className="mx-auto mt-10 max-w-2xl">
          <FaqAccordion items={HOME_FAQS} />
        </div>
      </Section>

      <CTASection
        title="Let's build your future together"
        description="Explore your options, get expert guidance, and take the first step towards your goals — in India or abroad."
        primaryLabel="View Plans"
        primaryHref="/pricing"
        secondaryLabel="Talk to an Expert"
        secondaryHref="/book-counselling"
        background="cinematic"
      />
    </>
  );
}
