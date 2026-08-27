import type { Metadata } from "next";
import Link from "next/link";
import { GitBranch, Lock, TrendingUp } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHero } from "@/components/sections/PageHero";
import { CTASection } from "@/components/sections/CTASection";
import { FaqAccordion } from "@/components/sections/FaqAccordion";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { AssessmentPreview } from "@/components/sections/career-discovery/AssessmentPreview";
import { ResultCardPreview } from "@/components/sections/career-discovery/ResultCardPreview";
import { WaitlistForm } from "@/components/sections/career-discovery/WaitlistForm";
import { DISCOVERY_FACTORS } from "@/data/career-discovery";
import { CAREER_DISCOVERY_FAQS } from "@/data/faqs";

export const metadata: Metadata = {
  title: "Career Discovery",
  description:
    "A preview of our career-first discovery approach — the signals it will consider, sample questions, and an illustrative result.",
};

export default function CareerDiscoveryPage() {
  return (
    <>
      <PageHero
        eyebrow="Career discovery"
        title="Understand your direction before you choose a course"
        description="This page previews how future career discovery will work. It does not run a live assessment yet — what you see is a structural preview, clearly labelled."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Career Discovery" }]}
      >
        <DemoNotice>
          The assessment engine is in development. Nothing on this page scores or stores real answers yet.
        </DemoNotice>
      </PageHero>

      <Section tone="surface">
        <SectionHeading eyebrow="What we consider" title="Multiple signals, not one label" description="Future recommendations are designed to weigh several factors together rather than reducing you to a single personality type." />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {DISCOVERY_FACTORS.map((factor) => (
            <Card key={factor.label}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-primary">{factor.label}</h3>
                <Badge tone="info">{factor.weight}%</Badge>
              </div>
              <p className="mt-2 text-sm text-muted">{factor.description}</p>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">
          Weights shown are the intended design for future scoring and may be refined as the model is built.
        </p>
      </Section>

      <Section tone="muted">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Try the format" title="Sample assessment preview" className="max-w-none" />
            <div className="mt-6">
              <AssessmentPreview />
            </div>
          </div>
          <div>
            <SectionHeading eyebrow="Illustrative output" title="What a result could look like" className="max-w-none" />
            <div className="mt-6">
              <ResultCardPreview />
            </div>
            <p className="mt-4 text-xs text-muted">
              Sample content only — not generated from real answers and not a genuine recommendation.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="surface">
        <div className="grid gap-8 sm:grid-cols-2">
          <Card>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <GitBranch aria-hidden="true" className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-primary">Skill-gap and roadmap outputs</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Once discovery points to a career direction, the plan is to map the skills that direction needs against
              what you already have, producing a practical roadmap of what to build next.
            </p>
          </Card>
          <Card>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <TrendingUp aria-hidden="true" className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-primary">A growing career library</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              We&apos;re building a broad library covering many Indian and international career paths. It isn&apos;t live yet
              — this milestone previews the structure it will use.
            </p>
          </Card>
        </div>

        <Card className="mt-6 flex items-start gap-3">
          <Lock aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
          <p className="text-sm leading-relaxed text-text-soft">
            <span className="font-semibold text-primary">Privacy note: </span>
            Any information you eventually share for discovery will be used only to help plan your journey, following
            the data principles in our{" "}
            <Link href="/trust" className="text-secondary-dark underline underline-offset-2">
              Trust Center
            </Link>
            . We do not request sensitive documents through this milestone.
          </p>
        </Card>
      </Section>

      <Section tone="muted">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionHeading eyebrow="Get notified" title="Join the assessment waitlist" className="max-w-none" />
            <p className="mt-3 text-sm text-muted">
              We&apos;ll let you know when the full discovery experience is ready. This form is a demo — see the note
              after submitting.
            </p>
            <div className="mt-6">
              <WaitlistForm />
            </div>
          </div>
          <div>
            <SectionHeading eyebrow="Questions" title="Career discovery FAQ" className="max-w-none" />
            <div className="mt-6">
              <FaqAccordion items={CAREER_DISCOVERY_FAQS} />
            </div>
          </div>
        </div>
      </Section>

      <CTASection primaryLabel="Book free counselling" secondaryLabel="See how it works" secondaryHref="/how-it-works" />
    </>
  );
}
