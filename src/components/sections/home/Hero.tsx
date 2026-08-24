import { ArrowRight, ShieldCheck, Users2, GitCompareArrows, Sparkle } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { LinkButton } from "@/components/ui/Button";
import { RoadmapVisual } from "./RoadmapVisual";

const REASSURANCE = [
  { icon: ShieldCheck, label: "Transparent guidance" },
  { icon: Users2, label: "Parent-inclusive planning" },
  { icon: GitCompareArrows, label: "India and abroad comparison" },
];

export function Hero() {
  return (
    <Section className="relative overflow-hidden pt-12 sm:pt-16 lg:pt-20" tone="default">
      {/* Subtle decorative background — purely visual, never affects layout or contrast */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 right-[-10%] h-[26rem] w-[26rem] rounded-full bg-secondary/10 blur-3xl" />
        <div className="absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary/25 bg-secondary-light px-3.5 py-1.5 text-sm font-semibold text-secondary-dark">
            <Sparkle aria-hidden="true" className="h-3.5 w-3.5" />
            Career decisions before course decisions
          </span>
          <h1 className="mt-5 text-[2.5rem] leading-[1.12] font-semibold text-primary balance sm:text-5xl lg:text-[3.4rem] lg:leading-[1.1]">
            Choose a career and education pathway you can actually stand behind.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            Most families pick a course first and figure out the career later — often after spending significant
            money. CareerPath AI helps students and parents work the other way around: understand the career, then
            choose the course, university, and country that genuinely fit.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <LinkButton href="/career-discovery" size="lg" trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
              Start career discovery
            </LinkButton>
            <LinkButton href="/how-it-works" size="lg" variant="outline">
              See how it works
            </LinkButton>
          </div>

          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3">
            {REASSURANCE.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm font-medium text-text-soft">
                <Icon aria-hidden="true" className="h-4 w-4 text-secondary" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <RoadmapVisual />
      </div>
    </Section>
  );
}
