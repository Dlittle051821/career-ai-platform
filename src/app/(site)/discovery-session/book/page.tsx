import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Clock3 } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { PageHero } from "@/components/sections/PageHero";
import { DiscoverySessionBookingForm } from "@/components/sections/discovery-session/DiscoverySessionBookingForm";
import { getMyActiveDiscoverySession } from "@/lib/supabase/discovery-sessions/book";
import { createClient } from "@/lib/supabase/server";
import { DISCOVERY_SESSION_STATUS_LABELS } from "@/types/discovery-session";

export const metadata: Metadata = {
  title: "Book a Discovery Session",
  description: "Book a free, no-obligation Discovery Session with a NextWise counsellor.",
};

/**
 * Milestone 11-B1 — the authenticated, real Discovery Session booking page.
 * Protected via PROTECTED_PATHS (src/lib/supabase/middleware.ts); the
 * redirect below is defense in depth, matching every other protected page.
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
      <PageHero
        eyebrow="Free Discovery Session"
        title="Let's talk about your goals"
        description="This first conversation is free and comes with no obligation to purchase anything. A counsellor will help you think through your options and start building your profile together."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Book a Discovery Session" }]}
      />

      <Section tone="surface">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            {activeSession ? (
              <Card className="flex items-start gap-3">
                <Clock3 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-secondary" />
                <div>
                  <p className="text-base font-semibold text-primary">
                    You already have a Discovery Session {DISCOVERY_SESSION_STATUS_LABELS[activeSession.status].toLowerCase()}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {activeSession.assignedCounsellorName
                      ? `${activeSession.assignedCounsellorName} will be in touch to confirm a time, if they haven't already.`
                      : "A counsellor will reach out to confirm a time that works for you."}
                  </p>
                  <Link href="/dashboard" className="mt-4 inline-block text-sm font-semibold text-secondary-dark hover:text-primary">
                    Back to my dashboard
                  </Link>
                </div>
              </Card>
            ) : (
              <>
                <SectionHeading eyebrow="Request a conversation" title="Tell us a little about you" className="max-w-none" />
                <div className="mt-6">
                  <DiscoverySessionBookingForm />
                </div>
              </>
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
            <Card>
              <p className="text-sm font-semibold text-primary">What happens next</p>
              <ol className="mt-3 space-y-2 text-sm text-text-soft">
                <li>1. We review what you shared here.</li>
                <li>2. A counsellor reaches out to confirm a time that works.</li>
                <li>3. You have a free, no-obligation conversation — and can build your profile together.</li>
              </ol>
            </Card>
          </div>
        </div>
      </Section>
    </>
  );
}
