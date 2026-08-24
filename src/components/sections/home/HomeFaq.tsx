import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FaqAccordion } from "@/components/sections/FaqAccordion";
import { HOME_FAQS } from "@/data/faqs";

export function HomeFaq() {
  return (
    <Section tone="muted">
      <SectionHeading eyebrow="Common questions" title="Frequently asked questions" align="center" className="mx-auto" />
      <div className="mx-auto mt-10 max-w-2xl">
        <FaqAccordion items={HOME_FAQS} />
      </div>
    </Section>
  );
}
