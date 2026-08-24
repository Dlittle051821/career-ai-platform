import { CircleAlert, HandCoins, ScanSearch } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";

const PROBLEMS = [
  {
    icon: ScanSearch,
    title: "Choosing a course without a career plan",
    description:
      "Many students pick a stream or course based on rank, trend, or pressure — then discover it doesn't lead where they wanted to go.",
  },
  {
    icon: HandCoins,
    title: "Comparing countries without knowing total cost",
    description:
      "Tuition is only part of the picture. Living cost, financing, and realistic work exposure all change the real comparison between India and abroad.",
  },
  {
    icon: CircleAlert,
    title: "Trusting advice without knowing how it's made",
    description:
      "Some consultants earn commissions tied to specific universities. Families deserve to know how a recommendation was actually arrived at.",
  },
];

export function DecisionProblems() {
  return (
    <Section tone="surface">
      <SectionHeading
        eyebrow="Why this matters"
        title="Three decisions families often get wrong — not from lack of effort"
        description="These mistakes are common, understandable, and avoidable with the right sequence and the right information."
      />
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PROBLEMS.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-error-light text-error">
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-primary">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}
