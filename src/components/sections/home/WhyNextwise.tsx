import { WhyEuropeSection } from "@/components/sections/europe-explorer/WhyEuropeSection";
import { Section } from "@/components/layout/Section";
import { HOMEPAGE_CONTAINER_CLASSNAME } from "./homepage-layout";

/**
 * UX10A — Homepage Section 5, "Why Nextwise".
 *
 * [... history preserved from UX10A through UX10-H07: see git history /
 * prior package docs for the full UX10A -> H02 -> H03 -> H07 narrative —
 * a three-column layout (left checklist, center photo + floating trust
 * card, right honest stat tiles) built specifically to avoid the
 * reference's own fabricated testimonial/stat content. That three-column
 * content is superseded below by UX10-EU02 — see that entry for why. ]
 *
 * UX10-EU02 "HOMEPAGE EUROPE ALIGNMENT" — this milestone's own brief is
 * explicit: "Update the existing benefits section. Heading: Why Study in
 * Europe? ... four clean benefit cards ... High-quality education / More
 * affordable options / Real career opportunities / Diverse and welcoming."
 * UX10-EU01 already built exactly this 4-card value-prop grid for
 * `/study-europe` (`WhyEuropeSection.tsx`), with every claim already
 * hedged per this same milestone's own honesty rule ("do not claim Europe
 * is universally cheaper... keep claims conservative and defensible") and
 * already covered by its own regression test
 * (`europe-explorer-honesty.test.ts`). Per this milestone's own "reuse
 * EU01 data/components where sensible... avoid duplicate truth sources"
 * instruction, this section reuses that exact component directly rather
 * than re-authoring four new cards inline.
 *
 * This does narrow the section's scope from "why choose Nextwise overall"
 * to "why study in Europe specifically" — a real, deliberate content
 * change, not an oversight (flagged in UX10-EU02_REFERENCE_AUDIT.md). The
 * old section's broader trust messaging (independent/no-commission-bias,
 * personalised counsellor guidance) is not deleted from the site: it
 * remains in the hero's own trust row, the Final CTA's trust items, and
 * the main nav's "Counselling" link. The "partner in your journey" line —
 * this project's own established brand phrase, not reference-mockup
 * copy — is kept here as the section's supporting line, now simply
 * pointed at this milestone's India + Europe positioning instead of a
 * generic global one, so it continues to read as the same Nextwise voice
 * rather than a jarring year-zero rewrite.
 */
export function WhyNextwise() {
  return (
    <Section tone="default" containerClassName={HOMEPAGE_CONTAINER_CLASSNAME} className="!py-10 sm:!py-12 lg:!py-16">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-wide text-secondary">
          <span aria-hidden="true" className="h-px w-6 bg-secondary" />
          Why Europe
        </p>
        <h2 className="text-2xl font-semibold text-primary sm:text-3xl">Why Study in Europe?</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
          More than a search engine — a partner in your journey, with trusted information and personalised guidance
          for India and Europe.
        </p>
      </div>

      <div className="mt-10">
        <WhyEuropeSection />
      </div>
    </Section>
  );
}
