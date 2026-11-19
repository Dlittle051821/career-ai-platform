import type { Metadata } from "next";
import { publicPageMetadata } from "@/config/seo";
import Link from "next/link";
import { ArrowRight, Compass, GraduationCap, MessageCircle, Sparkles, Target } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { CTASection } from "@/components/sections/CTASection";
import { Check } from "lucide-react";
import { CiShell, Journey } from "@/components/career-intelligence/CiShell";
import { CareerEntryActions, type EntryProgress } from "@/components/career-intelligence/CareerEntryActions";
import { GuestAnswersTransfer } from "@/components/career-intelligence/GuestAnswersTransfer";
import { canViewCareerIntelligence } from "@/lib/career-intelligence/access";
import { ASSESSMENT_SECTIONS, answersFromSnapshot, completedSectionKeys, hasAnyAnswer, isAssessmentComplete } from "@/lib/career-intelligence/assessment/model";
import { getCareerIntelligenceAccess } from "@/lib/supabase/career-intelligence-access";
import { getStudentProfileSnapshot } from "@/lib/supabase/student-profile";

/**
 * Career Intelligence V2 — the entry screen (approved design): the dark-blue
 * hero with Start Free Assessment, the journey indicator and the "What the
 * assessment covers" card. The state shown (start, resume, preview, open
 * report) comes from the server for a signed-in student and from this
 * device for a guest. The NW03.2 "Explore your path" links below it are kept.
 *
 * NW03.2 — Career Intelligence product landing page.
 *
 * This is a lightweight, additive entry point into the existing Career
 * surface area, not a rebuild of it. Every link below points at a route
 * that already exists and was already reachable before NW03 (see
 * docs/milestones/NW03/NW03_01_AUDIT.md section 2) — this page's only job
 * is to give "Career Intelligence" its own front door and a single place
 * that frames those existing pieces as one product, ahead of /studio/career
 * (the authenticated workspace, added in NW03.3) existing to receive a
 * signed-in visitor who clicks through from here.
 *
 * No new data, no new Supabase query, no fabricated content — purely
 * presentational composition of existing Section/Card/CTASection
 * primitives, matching the pattern already used by
 * src/app/(site)/career-discovery/page.tsx and
 * src/app/(site)/study-europe/page.tsx.
 */
export const metadata: Metadata = publicPageMetadata(
  "/career",
  "Career Guidance & Counselling for Students",
  "Explore career paths, compare options and get career guidance for students in India. Start with guided discovery or talk to a NextWise counsellor.",
);

const CAREER_LINKS = [
  {
    icon: Compass,
    title: "Career Discovery",
    description: "A short, interactive orientation to help you get your bearings before choosing a career and course.",
    href: "/career-discovery",
    linkLabel: "Start discovery",
  },
  {
    icon: Sparkles,
    title: "Explore careers",
    description: "Browse careers, what they actually involve day to day, and how to get there.",
    href: "/careers",
    linkLabel: "Browse careers",
  },
  {
    icon: GraduationCap,
    title: "Courses & universities",
    description: "Find courses and universities in India that match a path you're considering.",
    href: "/courses",
    linkLabel: "Find courses",
  },
  {
    icon: Target,
    title: "Personalised recommendations",
    description: "Get recommendation readiness and guidance tailored to your profile, once you've built one.",
    href: "/recommendations",
    linkLabel: "View recommendations",
  },
  {
    icon: MessageCircle,
    title: "Talk to a counsellor",
    description: "Book a free counselling conversation about your goals — no pressure, no obligation to buy anything.",
    href: "/book-counselling",
    linkLabel: "Book counselling",
  },
] as const;


export default async function CareerProductPage() {
  const access = await getCareerIntelligenceAccess();
  const signedIn = access !== "anonymous";
  let progress: EntryProgress = { kind: "new" };
  if (canViewCareerIntelligence(access)) {
    progress = { kind: "unlocked" };
  } else if (signedIn) {
    const snapshot = await getStudentProfileSnapshot();
    const answers = snapshot ? answersFromSnapshot(snapshot) : null;
    if (answers && isAssessmentComplete(answers)) progress = { kind: "complete" };
    else if (answers && hasAnyAnswer(answers)) progress = { kind: "partial", done: completedSectionKeys(answers).length };
  }

  return (
    <>
      <CiShell navy>
        {signedIn ? <GuestAnswersTransfer /> : null}
        <section className="entry on-navy" aria-labelledby="ci-entry-title">
          <div className="wrap entry-grid">
            <div>
              <span className="eyebrow">Career Intelligence</span>
              <h1 id="ci-entry-title" className="display">
                Understand yourself. Discover what comes next.
              </h1>
              <p className="lede">
                Explore your interests, strengths and ambitions through a guided assessment. Complete it for free. Unlock your personalised career
                recommendations when you’re ready.
              </p>
              <CareerEntryActions server={progress} signedIn={signedIn} />
              <Journey />
            </div>
            <aside className="entry-card" aria-labelledby="ci-entry-card">
              <h2 id="ci-entry-card">What the assessment covers</h2>
              <ul className="sec">
                {ASSESSMENT_SECTIONS.map((section) => (
                  <li key={section.key}>
                    <Check className="icon" aria-hidden="true" />
                    {section.rail}
                  </li>
                ))}
              </ul>
              <div className="meta">
                <span>
                  <b>About 10 minutes</b>
                </span>
                <span>
                  <b>Free</b> to complete
                </span>
                <span>Save and finish later</span>
              </div>
              <p style={{ margin: "14px 0 0", fontSize: 13.5, color: "var(--muted)" }}>
                Career Explorer stays free. Career Intelligence is guidance, not a guarantee of admission, employment or pay.
              </p>
            </aside>
          </div>
        </section>
      </CiShell>

      <Section tone="surface" id="explore">
        <SectionHeading
          eyebrow="Explore your path"
          title="Everything you need for your career direction"
          description="Each of these already exists on Nextwise today — this page just brings them together under Career Intelligence."
          align="center"
          className="mx-auto max-w-2xl"
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAREER_LINKS.map(({ icon: Icon, title, description, href, linkLabel }) => (
            <Card key={href} className="flex flex-col">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-primary">{title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{description}</p>
              <Link
                href={href}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-secondary-dark underline underline-offset-2"
              >
                {linkLabel}
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            </Card>
          ))}
        </div>
      </Section>

      <Section tone="muted">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <SectionHeading
              eyebrow="Also considering studying abroad?"
              title="That's a separate, optional path"
              description="Nextwise also runs Abroad — a separate product for researching and planning study abroad in six European countries. You can use Career Intelligence fully without ever touching it, and vice versa."
              className="max-w-none"
            />
            <div className="mt-6">
              <LinkButton href="/abroad" variant="outline" trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
                Explore Abroad
              </LinkButton>
            </div>
          </div>
        </div>
      </Section>

      <CTASection
        title="Ready to get a clearer picture?"
        description="Start with a free, no-pressure counselling conversation, or jump straight into career discovery."
        primaryLabel="Book free counselling"
        primaryHref="/book-counselling"
        secondaryLabel="Start career discovery"
        secondaryHref="/career-discovery"
      />
    </>
  );
}
