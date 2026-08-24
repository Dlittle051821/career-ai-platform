import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Badge } from "@/components/ui/Badge";
import { ComparisonTable } from "@/components/sections/ComparisonTable";
import { LinkButton } from "@/components/ui/Button";

const ROWS = [
  { label: "Career fit", india: "Depends on target role and course strength", abroad: "Depends on target role and country strengths" },
  { label: "Course duration", india: "Typically shorter for equivalent levels", abroad: "Varies — some programs run longer" },
  { label: "Total cost", india: "Calculated from selected pathway", abroad: "Calculated from selected pathway" },
  { label: "Financing", india: "Domestic education loans, family funding", abroad: "International loans, scholarships, family funding" },
  { label: "Work exposure", india: "Depends on institute and internships", abroad: "Varies by country's work-study rules" },
  { label: "Language & lifestyle", india: "Familiar language and culture", abroad: "Adjustment period varies by destination" },
];

export function IndiaAbroadPreview() {
  return (
    <Section tone="surface">
      <div className="flex flex-wrap items-center gap-3">
        <SectionHeading
          eyebrow="India vs abroad"
          title="Compare pathways on what actually matters"
          description="A preview of how we structure the comparison — no fabricated numbers, just the categories that deserve real analysis."
          className="max-w-2xl"
        />
      </div>
      <div className="mt-3">
        <Badge tone="neutral">Preview — figures calculated per student, not shown here</Badge>
      </div>
      <div className="mt-8">
        <ComparisonTable
          caption="Sample comparison of India and abroad study pathways"
          columns={["India", "Abroad"]}
          rows={ROWS.map((row) => ({ label: row.label, values: [row.india, row.abroad] }))}
        />
      </div>
      <div className="mt-8">
        <LinkButton href="/study-options" variant="outline">
          Explore study options in detail
        </LinkButton>
      </div>
    </Section>
  );
}
