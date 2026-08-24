import { ArrowRight, Check } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";

const PANELS = [
  {
    label: "I am a student",
    title: "Get clarity on where you're headed",
    points: ["Explore career directions that fit you", "See a realistic roadmap, not just a course list", "Understand the skills you need to build"],
    cta: { label: "Start career discovery", href: "/career-discovery" },
    tone: "secondary" as const,
  },
  {
    label: "I am a parent",
    title: "See the cost, safety, and process clearly",
    points: ["Understand realistic total cost before committing", "Get a written scope before any payment", "Stay involved with visibility into progress"],
    cta: { label: "Visit the parents page", href: "/parents" },
    tone: "accent" as const,
  },
];

export function StudentParentSplit() {
  return (
    <Section tone="muted">
      <SectionHeading
        eyebrow="Built for the whole family"
        title="Two perspectives, one shared plan"
        description="Students and parents often need different things from the same journey. We designed for both."
      />
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {PANELS.map((panel) => (
          <Card key={panel.label} className="flex flex-col">
            <span
              className={
                panel.tone === "secondary"
                  ? "inline-flex w-fit items-center rounded-full bg-secondary-light px-3 py-1 text-xs font-semibold text-secondary-dark"
                  : "inline-flex w-fit items-center rounded-full bg-accent-light px-3 py-1 text-xs font-semibold text-accent-dark"
              }
            >
              {panel.label}
            </span>
            <h3 className="mt-4 text-xl font-semibold text-primary">{panel.title}</h3>
            <ul className="mt-4 flex-1 space-y-2.5">
              {panel.points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm text-text-soft">
                  <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <LinkButton
                href={panel.cta.href}
                variant={panel.tone === "secondary" ? "primary" : "secondary"}
                trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}
              >
                {panel.cta.label}
              </LinkButton>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}
