import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { Section } from "@/components/layout/Section";
import { JourneySteps } from "@/components/sections/JourneySteps";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { JOURNEY_STAGES } from "@/data/journey";
import { getCurrentProfile, firstNameFrom } from "@/lib/supabase/profile";

export const metadata: Metadata = {
  title: "Your Roadmap",
};

export default async function RoadmapPage() {
  const profile = await getCurrentProfile();
  // Only use a possessive title ("Dipam's journey") when we actually have a
  // name — the "there" fallback reads as a broken sentence in possessive
  // form, so fall back to a name-free title instead of "there's journey".
  const title = profile?.fullName ? `${firstNameFrom(profile)}'s career-first journey` : "Your career-first journey";

  return (
    <>
      <PageHero
        eyebrow="Your roadmap"
        title={title}
        description="Every student follows the same ten stages, in free-to-explore order. This view shows the general journey — a roadmap personalised to your own interests and results is a later milestone."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Roadmap" }]}
      />
      <Section>
        <DemoNotice className="mb-8">
          This is the same illustrative journey shown on the public How It Works page — not yet generated from your
          own career discovery answers. Complete career discovery to eventually unlock a version built around you.
        </DemoNotice>
        <JourneySteps stages={JOURNEY_STAGES} variant="detailed" />
      </Section>
    </>
  );
}
