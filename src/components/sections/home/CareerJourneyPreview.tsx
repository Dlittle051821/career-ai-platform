import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { JourneySteps } from "@/components/sections/JourneySteps";
import { LinkButton } from "@/components/ui/Button";
import { JOURNEY_STAGES } from "@/data/journey";

const HOME_STAGE_IDS = ["self-understanding", "career-exploration", "skills", "course", "finance", "internship"];

export function CareerJourneyPreview() {
  const stages = JOURNEY_STAGES.filter((stage) => HOME_STAGE_IDS.includes(stage.id)).map((stage, index) => ({
    ...stage,
    order: index + 1,
  }));

  return (
    <Section tone="default">
      <SectionHeading
        eyebrow="The career-first journey"
        title="One connected journey, not six disconnected decisions"
        description="Each stage builds on the last, from understanding yourself to being genuinely job-ready."
      />
      <div className="mt-10">
        <JourneySteps stages={stages} variant="compact" />
      </div>
      <div className="mt-8">
        <LinkButton href="/how-it-works" variant="outline">
          See the full journey
        </LinkButton>
      </div>
    </Section>
  );
}
