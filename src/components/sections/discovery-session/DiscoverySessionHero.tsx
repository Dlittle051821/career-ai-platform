import { Calendar, GraduationCap, Landmark, LineChart, Wallet } from "lucide-react";
import { PageHero } from "@/components/sections/PageHero";

/**
 * CIUX-01B — the signed-in booking form page (/discovery-session/book),
 * first screen, on the shared PageHero. Replaces the UX10-DS01 hero
 * (campus-photo backdrop, student cut-out). Copy, the jump to the form and
 * the How It Works link are unchanged.
 */
const TRUST_ROW = [
  { icon: GraduationCap, label: "Free session" },
  { icon: Wallet, label: "No pressure to buy" },
  { icon: Landmark, label: "India & Europe guidance" },
  { icon: LineChart, label: "Parents welcome" },
];

export function DiscoverySessionHero() {
  return (
    <PageHero
      id="discovery-session"
      eyebrow="Free · No pressure"
      title="Start with a free"
      titleAccent="Discovery Session."
      description="Get personalised guidance from a Nextwise counsellor to help you make confident decisions about your career, courses and study options in India and Europe."
      primaryAction={{ href: "#discovery-session-form", label: "Book free session" }}
      secondaryAction={{ href: "/how-it-works", label: "How it works", icon: <Calendar aria-hidden="true" /> }}
      points={TRUST_ROW}
    />
  );
}
