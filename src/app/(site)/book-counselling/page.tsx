import type { Metadata } from "next";
import { DiscoveryEntryHero } from "@/components/sections/book-counselling/DiscoveryEntryHero";
import { DiscoveryEntryExplainerCards } from "@/components/sections/book-counselling/DiscoveryEntryExplainerCards";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Free Discovery Session | Nextwise",
  description:
    "Start with a free Nextwise Discovery Session to discuss your career and study options in India and Europe.",
  alternates: { canonical: "/book-counselling" },
};

/**
 * UX10-DS02 "Public Discovery Entry & Auth Flow" — `/book-counselling`
 * rebuilt as a genuine public Discovery Session entry page, replacing the
 * Milestone-1 demo form that used to live here (BookingForm.tsx — its own
 * success state told visitors their submission "was not transmitted,
 * booked, or stored anywhere," which this milestone's own non-negotiable
 * rules explicitly forbid continuing to ship).
 *
 * ROUTE STRATEGY (see UX10-DS02_REFERENCE_AUDIT.md for the full audit):
 * this page is the public landing; the real, database-backed booking
 * workflow stays exactly where UX10-DS01 left it, at
 * /discovery-session/book. This page never renders a booking form of its
 * own — it only explains the session and sends a visitor to Create Free
 * Account / Sign In (both carrying `next=/discovery-session/book`, so a
 * successful sign-in returns them straight to the real booking page — see
 * LoginForm.tsx) or, if they're already signed in, straight to the real
 * booking page directly.
 *
 * WHY BookingForm.tsx WAS NOT DELETED: src/config/site.test.ts's rebrand
 * regression suite asserts that file still exists on disk (it's on the
 * "must never mention the old brand name" list). Deleting it would break
 * an unrelated, pre-existing test for no functional benefit — leaving it
 * in place, simply no longer imported by this page, is the safe choice
 * (brief section 17's own "remove them only if safe" instruction).
 *
 * AUTH STATE: this is a Server Component, so the real signed-in/signed-out
 * state is read once, server-side, via the same `createClient()` +
 * `supabase.auth.getUser()` pattern UX10-DS01's own page.tsx uses — no
 * client-side flash of the wrong CTA state, and no private profile data is
 * fetched (only the boolean fact of whether a user session exists).
 */
export default async function BookCounsellingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <DiscoveryEntryHero isAuthenticated={Boolean(user)} />
      <DiscoveryEntryExplainerCards />
    </>
  );
}
