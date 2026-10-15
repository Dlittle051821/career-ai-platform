import type { Metadata } from "next";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CTASection } from "@/components/sections/CTASection";
import { EuropeExplorerHero } from "@/components/sections/europe-explorer/EuropeExplorerHero";
import { EuropeCountryCards } from "@/components/sections/europe-explorer/EuropeCountryCards";
import { WhyEuropeSection } from "@/components/sections/europe-explorer/WhyEuropeSection";
import { EuropeComparisonSection } from "@/components/sections/europe-explorer/EuropeComparisonSection";
import { EuropeOfficialSourcesSection } from "@/components/sections/europe-explorer/EuropeOfficialSourcesSection";
import { EuropeHowNextwiseHelps } from "@/components/sections/europe-explorer/EuropeHowNextwiseHelps";

/**
 * UX10-EU01 "Europe Country Explorer" — new public route.
 *
 * ROUTE DECISION (see UX10-EU01_REFERENCE_AUDIT.md section "Route
 * Decision" for the full reasoning): the brief's own first-preference
 * route, `/study-options`, already exists as the public India-vs-abroad
 * decision page, but it is a broad pathway-comparison page (cost
 * categories, ROI honesty notes, a course-selection checklist), not a
 * country-by-country destination explorer. Appending this milestone's
 * 6-section flagship explorer onto that page would roughly triple its
 * length and blur its existing "compare pathways honestly" purpose.
 * `/study-europe` is a new, dedicated route — the brief's own documented
 * fallback ("a new /study-europe or /europe route if cleaner and safer").
 * `/study-options`'s own "Europe" pathway card, and UX10-HW01's dual-
 * pathway "Explore Europe options" CTA, now point here instead of
 * `/study-options#europe` — both minimal, documented nav updates; no
 * route was removed or broken.
 *
 * ARCHITECTURE: this page is intentionally static/presentational, like
 * UX10-HW01's `/how-it-works` — no Supabase queries, no new database
 * dependency. See `src/data/europe-explorer.ts` and
 * `EuropeOfficialSourcesSection.tsx` for why country official-source
 * links are plain, verified external links rather than routed through the
 * DB-backed M20 `/go/course-search/**` redirect.
 */
export const metadata: Metadata = {
  title: "Study in Europe — Country Explorer",
  description:
    "Compare Germany, Ireland, Netherlands, France, Sweden, and Denmark on tuition, English-taught programmes, admissions, and post-study options, then go directly to each country's trusted official source.",
  alternates: { canonical: "/study-europe" },
};

export default function StudyEuropePage() {
  return (
    <>
      <EuropeExplorerHero />

      <Section tone="surface">
        <SectionHeading
          eyebrow="Popular European countries"
          title="Explore top European study destinations"
          description="Each country offers unique opportunities. Compare key information and explore official sources."
          titleClassName="font-sans text-text"
          align="center"
          className="mx-auto max-w-2xl"
        />
        <div className="mt-10">
          <EuropeCountryCards />
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="Why Europe"
          title="A smart choice for your future"
          titleClassName="font-sans text-text"
          align="center"
          className="mx-auto max-w-2xl"
        />
        <div className="mt-10">
          <WhyEuropeSection />
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeading
          eyebrow="Compare countries"
          title="Key factors at a glance"
          titleClassName="font-sans text-text"
          align="center"
          className="mx-auto max-w-2xl"
        />
        <div className="mt-10">
          <EuropeComparisonSection />
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="Trusted official sources"
          title="Go directly to official sources"
          description="We guide you to trusted government and education portals so you have accurate, up-to-date information."
          titleClassName="font-sans text-text"
          align="center"
          className="mx-auto max-w-2xl"
        />
        <div className="mt-10">
          <EuropeOfficialSourcesSection />
        </div>
      </Section>

      <Section tone="surface">
        <SectionHeading
          eyebrow="How Nextwise helps"
          title="From research to your next step"
          titleClassName="font-sans text-text"
          align="center"
          className="mx-auto max-w-2xl"
        />
        <div className="mt-10">
          <EuropeHowNextwiseHelps />
        </div>
      </Section>

      <CTASection
        title="Let's find the right country for you"
        description="Get personalised guidance, compare your options, and take the first step with confidence."
        primaryLabel="Explore Countries"
        primaryHref="#europe-countries"
        secondaryLabel="Talk to an Expert"
        secondaryHref="/book-counselling"
        background="cinematic"
      />
    </>
  );
}
