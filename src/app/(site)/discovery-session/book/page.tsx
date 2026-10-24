import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock3, ShieldCheck } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { CTASection } from "@/components/sections/CTASection";
import { DiscoverySessionHero } from "@/components/sections/discovery-session/DiscoverySessionHero";
import { SessionStepsSection } from "@/components/sections/discovery-session/SessionStepsSection";
import { DiscussionAndOutcomesSection } from "@/components/sections/discovery-session/DiscussionAndOutcomesSection";
import { AudienceAndExpectationsSection } from "@/components/sections/discovery-session/AudienceAndExpectationsSection";
import { SessionTrustCard } from "@/components/sections/discovery-session/SessionTrustCard";
import { DiscoverySessionBookingForm } from "@/components/sections/discovery-session/DiscoverySessionBookingForm";
import { getMyActiveDiscoverySession } from "@/lib/supabase/discovery-sessions/book";
import { createClient } from "@/lib/supabase/server";
import { DISCOVERY_SESSION_STATUS_LABELS } from "@/types/discovery-session";
import { formatDiscoverySessionDateTime } from "@/lib/discovery-sessions/format";

export const metadata: Metadata = {
  title: "Free Discovery Session | Nextwise",
  description:
    "Book a free Nextwise Discovery Session to discuss your career, study options in India and Europe, and your next steps.",
};

/**
 * UX10-DS01 "Discovery Session Redesign" — a premium, trustworthy, low-
 * pressure redesign of the real Discovery Session booking page, matching
 * the approved reference image's section order (hero, what-happens-in-the-
 * session, what-we'll-discuss + what-you'll-receive, who-should-book + a-
 * few-important-things-to-know, the real booking form + counsellor trust
 * card, final CTA).
 *
 * ROUTE DECISION (see UX10-DS01_REFERENCE_AUDIT.md for the full audit):
 * this codebase has two separate "free session" entry points. /book-
 * counselling is the one every other public page links to as "Talk to an
 * Expert" / "Book Free Session" — but its own BookingForm.tsx is an
 * explicit, on-screen-labelled Milestone-1 demo that validates locally and
 * "was not transmitted, booked, or stored anywhere." /discovery-session/
 * book (this page) is the ONE real, database-backed Discovery Session
 * workflow (DiscoverySessionBookingForm -> bookDiscoverySessionAction ->
 * bookDiscoverySession() -> a real `discovery_sessions` row, real RLS, a
 * real admin Counsellor Workspace, and a real `discovery_session_booked`
 * analytics event). Per this milestone's own non-negotiable "do not build a
 * fake form" / "preserve the real existing booking workflow" rules (and the
 * user's own explicit instruction to prefer the real workflow over an exact
 * mockup match), this page — the real one — is what gets redesigned.
 * /book-counselling is left completely untouched; the sitewide mismatch
 * (public CTAs pointing at the fake demo instead of this real page) is
 * flagged as a follow-up recommendation, not silently fixed here, since
 * repointing those CTAs touches several already-shipped pages outside this
 * milestone's scope.
 *
 * AUTH-GATE (the one documented, deliberate deviation from the reference's
 * visually "anyone can see this" composition — see
 * UX10-DS01_REFERENCE_AUDIT.md section 7 for the full writeup): an earlier
 * draft of this milestone tried to make every marketing section above
 * publicly visible and gate only the real form's own slot behind a sign-in
 * prompt. That turned out to be impossible to do honestly: the entire
 * `/discovery-session` subtree is independently gated at the edge by this
 * codebase's own middleware (`PROTECTED_PATHS` in
 * src/lib/supabase/middleware.ts already lists "/discovery-session" before
 * this milestone, and still does — untouched), which redirects an
 * unauthenticated request to /login before this page's own code ever runs,
 * regardless of what this component renders. Loosening that middleware
 * entry would be a real security-configuration change this milestone's own
 * non-negotiable rules forbid ("do not modify security settings", "preserve
 * ... anti-spam/security handling"), so it was reverted. The `redirect()`
 * call below is kept exactly as it was before this milestone (the same
 * "defense in depth, matching every other protected page" comment that was
 * already here), and is in practice redundant with the middleware, not a
 * replacement for it.
 *
 * The practical consequence: this redesigned page is only ever seen by a
 * signed-in Nextwise student (reached via the dashboard's "Discovery
 * Session" nav item, the mobile tab bar's "Guidance" tab, or
 * ProfileCounsellorCard's link) — not by an anonymous visitor following the
 * brief's own described public funnel (Homepage -> ... -> Discovery Session
 * -> counsellor). In the real, current repo, that public funnel's actual
 * terminal page is /book-counselling, a separate, pre-existing route whose
 * own form is an explicit Milestone-1 demo with no real backend (see the
 * route-decision note above and UX10-DS01_REFERENCE_AUDIT.md). Reconciling
 * that gap — building a true public, unauthenticated, real top-of-funnel
 * Discovery Session flow — would require either loosening real middleware
 * security configuration or building new backend persistence for
 * anonymous leads, both explicitly out of this UX-redesign milestone's
 * scope; it is flagged as a follow-up recommendation, not attempted here.
 */
export default async function DiscoverySessionBookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/discovery-session/book");

  const activeSession = await getMyActiveDiscoverySession();

  return (
    <>
      <DiscoverySessionHero />
      <SessionStepsSection />
      <DiscussionAndOutcomesSection />
      <AudienceAndExpectationsSection />

      <Section id="discovery-session-form" tone="default">
        <SectionHeading
          eyebrow="Ready when you are"
          title="Book Your Free Discovery Session"
          description="Choose a convenient time and our team will confirm your session."
        />
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            {activeSession ? (
              <Card className="flex items-start gap-3">
                <Clock3 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-secondary" />
                <div>
                  <p className="text-base font-semibold text-primary">
                    You already have a Discovery Session {DISCOVERY_SESSION_STATUS_LABELS[activeSession.status].toLowerCase()}
                  </p>
                  {/*
                    NW01 Part G — confirmed defect: this always said "will
                    be in touch to confirm a time", even once the session's
                    real `scheduledAt` was already set (status "scheduled")
                    — stale, and contradicted the dashboard's own Discovery
                    Session card, which already showed the real time. A
                    `preferredTimeRange` (a STUDENT-submitted preference,
                    never a confirmed slot — see DiscoverySessionBookingForm's
                    own "This is a preference, not a confirmed appointment
                    slot" hint) is still never shown here as if it were one.
                  */}
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {activeSession.scheduledAt
                      ? `Confirmed for ${formatDiscoverySessionDateTime(activeSession.scheduledAt)}${
                          activeSession.assignedCounsellorName ? ` with ${activeSession.assignedCounsellorName}` : ""
                        }.`
                      : activeSession.assignedCounsellorName
                        ? `${activeSession.assignedCounsellorName} will be in touch to confirm a time, if they haven't already.`
                        : "A counsellor will reach out to confirm a time that works for you."}
                  </p>
                  <Link href="/dashboard" className="mt-4 inline-block text-sm font-semibold text-secondary-dark hover:text-primary">
                    Back to my dashboard
                  </Link>
                </div>
              </Card>
            ) : (
              <DiscoverySessionBookingForm />
            )}
          </div>
          <div className="space-y-5">
            <Card className="flex items-start gap-3">
              <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
              <p className="text-sm leading-relaxed text-text-soft">
                Your details stay private and are used only to prepare for and follow up on this conversation. No
                obligation, no pressure to buy a package.
              </p>
            </Card>
            <SessionTrustCard />
          </div>
        </div>
      </Section>

      <CTASection
        title="Take the first step towards your future"
        description="Get clarity, explore your options and make confident decisions with Nextwise."
        primaryLabel="Book Free Session"
        primaryHref="#discovery-session-form"
        secondaryLabel="Talk to an Expert"
        secondaryHref="/book-counselling"
        background="cinematic"
      />
    </>
  );
}
