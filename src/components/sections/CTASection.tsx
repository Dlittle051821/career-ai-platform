import { ArrowRight, ShieldCheck } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LinkButton } from "@/components/ui/Button";

interface CTASectionProps {
  title?: string;
  description?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

/** Calm, non-manipulative closing conversion section reused across pages. */
export function CTASection({
  title = "Make your next decision a little clearer",
  description = "Talk to a counsellor about your goals — no pressure, and no obligation to buy anything.",
  primaryLabel = "Book free counselling",
  primaryHref = "/book-counselling",
  secondaryLabel = "Explore career discovery",
  secondaryHref = "/career-discovery",
}: CTASectionProps) {
  return (
    <Section tone="primary">
      <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
        <SectionHeading light title={title} description={description} className="lg:max-w-xl" />
        <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
          <LinkButton href={primaryHref} variant="secondary" size="lg" trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
            {primaryLabel}
          </LinkButton>
          <LinkButton
            href={secondaryHref}
            variant="outline"
            size="lg"
            className="border-white/30 text-on-primary hover:bg-white/10"
          >
            {secondaryLabel}
          </LinkButton>
        </div>
      </div>
      <p className="mt-8 flex items-center gap-2 text-sm text-on-primary-muted">
        <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
        Your details stay private and are only used to contact you about your enquiry.
      </p>
    </Section>
  );
}
