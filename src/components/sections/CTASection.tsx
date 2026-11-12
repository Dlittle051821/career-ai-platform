import { ArrowRight, ShieldCheck } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LinkButton } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface CTASectionProps {
  title?: string;
  description?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  /**
   * UX10-HW01 — optional richer closing-CTA treatment ("cinematic", per the
   * How It Works reference image's final section) layered on top of the
   * existing `tone="primary"` background via extra radial glow washes in
   * the same brand tokens (`--brand-intelligence` / `--brand-primary`) this
   * codebase's own `GeometricBackdrop` uses elsewhere — no photo, no new
   * color. Purely additive: every existing caller omits this prop and
   * keeps the exact same plain `tone="primary"` background as before.
   */
  background?: "default" | "cinematic";
}

/** Calm, non-manipulative closing conversion section reused across pages. */
export function CTASection({
  title = "Make your next decision a little clearer",
  description = "Talk to a counsellor about your goals — no pressure, and no obligation to buy anything.",
  primaryLabel = "Book free counselling",
  primaryHref = "/book-counselling",
  secondaryLabel = "Explore career discovery",
  secondaryHref = "/career-discovery",
  background = "default",
}: CTASectionProps) {
  return (
    <Section tone="primary" className={cn(background === "cinematic" && "relative overflow-hidden")}>
      {background === "cinematic" ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 70% at 85% 0%, color-mix(in srgb, var(--brand-intelligence) 20%, transparent) 0%, transparent 70%), radial-gradient(55% 60% at 10% 100%, color-mix(in srgb, var(--color-primary-light) 22%, transparent) 0%, transparent 70%)",
          }}
        />
      ) : null}
      <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
        <SectionHeading light title={title} description={description} className="lg:max-w-xl" />
        <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
          <LinkButton href={primaryHref} variant="primary" size="lg" trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
            {primaryLabel}
          </LinkButton>
          <LinkButton
            href={secondaryHref}
            variant="outline-inverse"
            size="lg"
            // CIUX-01: outline-inverse is the button system's outline for dark
            // surfaces (white label and hairline). It replaces the UX10-HW01
            // "!text-on-primary" override that kept this label from rendering
            // in the band's own colour.
          >
            {secondaryLabel}
          </LinkButton>
        </div>
      </div>
      <p className="mt-8 flex items-center gap-2 text-sm text-on-primary-strong">
        <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
        Your details stay private and are only used to contact you about your enquiry.
      </p>
    </Section>
  );
}
