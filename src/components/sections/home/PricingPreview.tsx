import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PricingCard } from "@/components/sections/PricingCard";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PRICING_PACKAGES } from "@/data/pricing";

export function PricingPreview() {
  return (
    <Section tone="surface">
      <SectionHeading
        eyebrow="Sample packages"
        title="Provisional pricing for planning purposes"
        description="Three working packages to help you plan. Final scope and pricing are confirmed in writing before you pay."
      />
      <div className="mt-3">
        <Badge tone="neutral">Provisional pricing — not final</Badge>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {PRICING_PACKAGES.map((pkg, index) => (
          <PricingCard key={pkg.id} pkg={pkg} highlight={index === 1} />
        ))}
      </div>
      <div className="mt-8">
        <LinkButton href="/pricing" variant="outline">
          See full pricing details
        </LinkButton>
      </div>
    </Section>
  );
}
