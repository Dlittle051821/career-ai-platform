import { CalendarCheck, Compass, HeartHandshake, Scale, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { PageHero, HeroStepsCard, type HeroStep } from "@/components/sections/PageHero";
import { DISCOVERY_SESSION_CTA } from "@/config/site";

/**
 * CIUX-01B — How It Works, first screen, on the shared PageHero (the
 * homepage's visual language). Replaces the UX10-HW01 hero (campus-photo
 * backdrop, student cut-out, blue/orange buttons, Europe-first headline).
 *
 * Copy follows the CIUX-01B brief and only names what exists today: the free
 * Career Discovery tool, the career explorer, the course and university
 * explorers with comparison, and the free Discovery Session (public booking
 * page /book-counselling). The deeper page content below is unchanged; its
 * redesign is CIUX-02.
 */
const JOURNEY: HeroStep[] = [
  {
    icon: Sparkles,
    title: "Discover your direction",
    text: "A guided look at your interests and strengths.",
    tag: "Free",
    href: "/career-discovery",
  },
  {
    icon: Compass,
    title: "Explore careers",
    text: "What each career involves and how people get there.",
    href: "/careers",
  },
  {
    icon: Scale,
    title: "Compare courses and countries",
    text: "Universities and courses in India and Europe, side by side.",
    href: "/courses",
  },
  {
    icon: HeartHandshake,
    title: "Talk it through",
    text: "A Discovery Session with a Nextwise counsellor.",
    tag: "Free",
    href: DISCOVERY_SESSION_CTA.href,
    focus: true,
  },
];

const POINTS = [
  { icon: UserCheck, label: "Personalised guidance" },
  { icon: ShieldCheck, label: "Honest, no-pressure support" },
  { icon: Compass, label: "India and Europe" },
];

export function HowItWorksHero() {
  return (
    <PageHero
      id="how-it-works"
      eyebrow="How Nextwise works"
      title="Your next step,"
      titleAccent="made clearer."
      description="Explore careers, understand your education options and find the right support for your journey, from your first questions to your next decision."
      primaryAction={{ href: "/careers", label: "Explore careers" }}
      secondaryAction={{
        href: DISCOVERY_SESSION_CTA.href,
        label: "Book a free Discovery Session",
        icon: <CalendarCheck aria-hidden="true" />,
      }}
      points={POINTS}
      visual={<HeroStepsCard title="Your journey with Nextwise" label="Your journey with Nextwise" steps={JOURNEY} />}
    />
  );
}
