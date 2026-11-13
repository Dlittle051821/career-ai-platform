import { Compass, GraduationCap, Landmark, LineChart, LogIn, MapPin, Wallet } from "lucide-react";
import Link from "next/link";
import { PageHero, HeroStepsCard, type HeroStep } from "@/components/sections/PageHero";

/**
 * CIUX-01B — Book your free Discovery Session (/book-counselling), first
 * screen, on the shared PageHero. Replaces the UX10 hero (campus-photo
 * backdrop, student cut-out with question bubbles). The routes and the
 * signed-in / signed-out behaviour are unchanged: signed in goes straight to
 * the booking form (/discovery-session/book); signed out creates an account
 * or signs in first and returns to the form (`next`). No auth logic here.
 *
 * The visual lists the questions people bring to a first session (the old
 * hero's question bubbles), as plain topics, not links.
 */
const TRUST_ROW = [
  { icon: GraduationCap, label: "Free session" },
  { icon: Wallet, label: "No pressure to buy" },
  { icon: Landmark, label: "India & Europe guidance" },
  { icon: LineChart, label: "Parents welcome" },
];

const QUESTIONS: HeroStep[] = [
  { icon: Compass, title: "Which career suits me?", text: "Your interests, strengths and the options they open." },
  { icon: GraduationCap, title: "Which course should I choose?", text: "Subjects, entry requirements and what comes after." },
  { icon: MapPin, title: "India or abroad?", text: "Destinations, intakes and what each path involves." },
  { icon: Wallet, title: "Is it affordable?", text: "Costs, funding and realistic budgets for your family.", focus: true },
];

interface DiscoveryEntryHeroProps {
  isAuthenticated: boolean;
}

export function DiscoveryEntryHero({ isAuthenticated }: DiscoveryEntryHeroProps) {
  return (
    <PageHero
      id="book-counselling"
      eyebrow="Free · No pressure"
      title="Book your free"
      titleAccent="Discovery Session."
      description="Get personalised guidance from a Nextwise counsellor to help you make confident decisions about your career, courses and study options in India and Europe."
      primaryAction={
        isAuthenticated
          ? { href: "/discovery-session/book", label: "Book free session" }
          : { href: "/register?next=/discovery-session/book", label: "Create free account" }
      }
      secondaryAction={
        isAuthenticated
          ? undefined
          : { href: "/login?next=/discovery-session/book", label: "Sign in", icon: <LogIn aria-hidden="true" /> }
      }
      points={TRUST_ROW}
      visual={<HeroStepsCard title="Questions people bring" label="Questions people bring to a Discovery Session" steps={QUESTIONS} />}
    >
      {isAuthenticated ? null : (
        <p className="text-sm text-text-soft">
          Already have an account?{" "}
          <Link href="/login?next=/discovery-session/book" className="font-medium text-secondary-dark underline underline-offset-2">
            Sign in instead
          </Link>
          .
        </p>
      )}
    </PageHero>
  );
}
