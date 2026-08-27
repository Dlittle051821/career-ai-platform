import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { PageHero } from "@/components/sections/PageHero";
import { BookingForm } from "@/components/sections/book-counselling/BookingForm";

export const metadata: Metadata = {
  title: "Book Free Counselling",
  description: "Request a free, no-obligation counselling conversation about your career and education goals.",
};

export default function BookCounsellingPage() {
  return (
    <>
      <PageHero
        eyebrow="Book free counselling"
        title="Tell us about your goals — we'll take it from there"
        description="This first conversation is free and comes with no obligation to purchase anything. Share a few details so we can prepare for a useful conversation."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Book Counselling" }]}
      />

      <Section tone="surface">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <SectionHeading eyebrow="Request a conversation" title="Your details" className="max-w-none" />
            <div className="mt-6">
              <BookingForm />
            </div>
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
                <li>1. We review your goals and interest area.</li>
                <li>2. A counsellor reaches out to confirm a time that works.</li>
                <li>3. You have a free, no-obligation conversation.</li>
              </ol>
            </Card>
          </div>
        </div>
      </Section>
    </>
  );
}
