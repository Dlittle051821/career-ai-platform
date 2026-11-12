import { Building2, CalendarCheck, Compass, Globe2, Sparkles } from "lucide-react";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { DISCOVERY_SESSION_CTA } from "@/config/site";

/**
 * CIUX-01 — "Start here": direct routes into the main student features,
 * placed after the homepage story and before the footer. Each card is one
 * real, public route. The approved V5.4 scenes above are not changed.
 *
 * A Free Resume Builder card is deliberately absent: no resume feature
 * exists in this codebase yet (CIUX-06), and the homepage must not link to
 * a feature that does not work.
 */
const CARDS = [
  {
    href: "/careers",
    title: "Explore careers",
    description: "What each career involves, the skills it needs and how to get there.",
    icon: <Compass className="h-5 w-5" />,
  },
  {
    href: "/courses",
    title: "Universities & courses",
    description: "Search courses and compare universities in India and Europe.",
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    href: "/abroad",
    title: "Study abroad",
    description: "Six European destinations: costs, intakes and pathways, explained.",
    icon: <Globe2 className="h-5 w-5" />,
  },
  {
    href: "/career-discovery",
    title: "Career discovery",
    description: "A free, guided look at your interests and strengths.",
    icon: <Sparkles className="h-5 w-5" />,
    eyebrow: "Free tool",
  },
];

export function QuickExplore() {
  return (
    <section aria-labelledby="ciux-quick-explore" className="ciux-quick-explore bg-background">
      <div className="mx-auto w-full max-w-[1320px] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-2xl">
          <h2 id="ciux-quick-explore" className="text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)]">
            Start where you are
          </h2>
          <p className="mt-3 text-[length:var(--text-lead)] leading-[var(--text-lead--line-height)] text-muted">
            Go straight to the part of Nextwise you need today.
          </p>
        </div>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <li className="sm:col-span-2 lg:col-span-2 lg:row-span-2">
            <FeatureCard
              tone="ink"
              href={DISCOVERY_SESSION_CTA.href}
              eyebrow="Free"
              title="Book a Discovery Session"
              description="Talk through your options with a Nextwise counsellor before you decide anything. It is free."
              icon={<CalendarCheck className="h-5 w-5" />}
              className="lg:min-h-full lg:p-8"
            />
          </li>
          {CARDS.map((card) => (
            <li key={card.href} className="lg:col-span-2">
              <FeatureCard {...card} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
