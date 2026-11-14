import { Compass, GraduationCap, Landmark, LineChart, LogIn, MapPin, Phone, Wallet } from "lucide-react";
import { OFFICIAL_CONTACT } from "@/config/contact";
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
  /**
   * V5.6.2 public launch: false in public-marketing mode, where online accounts
   * and booking are closed. The session is then booked by email or phone.
   */
  accountsOpen?: boolean;
}

/** Opens the visitor's own email app; nothing is sent or stored by Nextwise. */
export const DISCOVERY_SESSION_EMAIL_HREF = `${OFFICIAL_CONTACT.founder.mailto}?subject=${encodeURIComponent(
  "Free Discovery Session — Nextwise",
)}`;

export function DiscoveryEntryHero({ isAuthenticated, accountsOpen = true }: DiscoveryEntryHeroProps) {
  // V5.6.2 public launch: with accounts closed, the session is booked by email or phone.
  const primaryAction = !accountsOpen
    ? { href: DISCOVERY_SESSION_EMAIL_HREF, label: "Email to book" }
    : isAuthenticated
      ? { href: "/discovery-session/book", label: "Book free session" }
      : { href: "/register?next=/discovery-session/book", label: "Create free account" };
  const secondaryAction = !accountsOpen
    ? { href: OFFICIAL_CONTACT.phone.tel, label: `Call ${OFFICIAL_CONTACT.phone.display}`, icon: <Phone aria-hidden="true" /> }
    : isAuthenticated
      ? undefined
      : { href: "/login?next=/discovery-session/book", label: "Sign in", icon: <LogIn aria-hidden="true" /> };

  return (
    <PageHero
      id="book-counselling"
      eyebrow="Free · No pressure"
      title="Book your free"
      titleAccent="Discovery Session."
      description={
        accountsOpen
          ? "Get personalised guidance from a Nextwise counsellor to help you make confident decisions about your career, courses and study options in India and Europe."
          : "Get personalised guidance from Nextwise to help you make confident decisions about your career, courses and study options in India and Europe."
      }
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      points={TRUST_ROW}
      visual={<HeroStepsCard title="Questions people bring" label="Questions people bring to a Discovery Session" steps={QUESTIONS} />}
    >
      {!accountsOpen ? (
        <p className="text-sm text-text-soft" data-testid="accounts-closed-note">
          Online accounts and booking aren&apos;t open yet. Email or call us and we&apos;ll arrange your free session with
          you directly.
        </p>
      ) : isAuthenticated ? null : (
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
