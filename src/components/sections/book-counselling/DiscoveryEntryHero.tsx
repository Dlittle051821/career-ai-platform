import { ArrowRight, GraduationCap, Landmark, LineChart, LogIn, UserPlus, Wallet } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { LinkButton } from "@/components/ui/Button";
import { FADE_UP_CLASSES, HOVER_LIFT_CLASSES } from "@/lib/ui/motion";
import { getGraphicAriaProps } from "@/lib/graphics/accessible-graphic";
import { cn } from "@/lib/utils";

/**
 * UX10-DS02 "Public Discovery Entry & Auth Flow" — the public, no-login
 * hero for the rebuilt `/book-counselling` landing page, matching the
 * approved DS02 reference's "Public Discovery Landing" state.
 *
 * Same asset-reuse decision as UX10-DS01's DiscoverySessionHero.tsx (and,
 * before that, HowItWorksHero.tsx/CareersHero.tsx): the reference's
 * background photo is not an asset that exists or has been approved in
 * this repo, so this hero reuses the same already-approved
 * `/hero/campus-sky-backdrop.png` + `/hero/nextwise-student-cutout.png`
 * assets and the generic `.careers-hero-stage` CSS family rather than
 * generating new, unapproved photography.
 *
 * The decorative floating question bubbles reuse `z-20` from the start
 * (not an afterthought) — UX10-DS01's own hero visual QA found that these
 * bubbles render *behind* the portrait image unless given a higher
 * z-index than the portrait's own `z-index: 2` (globals.css); see
 * DiscoverySessionHero.tsx's docblock for the full account of that bug.
 */

const TRUST_ROW = [
  { icon: GraduationCap, label: "Free session" },
  { icon: Wallet, label: "No pressure to buy" },
  { icon: Landmark, label: "India & Europe guidance" },
  { icon: LineChart, label: "Parents welcome" },
];

const QUESTION_BUBBLES = [
  { label: "Career options?", className: "left-[6%] top-[14%] sm:left-[8%]" },
  { label: "Which country?", className: "left-[2%] top-[46%] sm:left-[4%]" },
  { label: "Which course?", className: "right-[6%] top-[10%] sm:right-[8%]" },
  { label: "Is it affordable?", className: "right-[6%] top-[42%] sm:right-[8%]" },
  { label: "What are my chances?", className: "right-[16%] bottom-[10%] sm:right-[18%]" },
];

interface DiscoveryEntryHeroProps {
  /**
   * Whether the visitor already has a live session. When true, the two
   * auth CTAs (Create Free Account / Sign In) are replaced with a single
   * direct "Book Free Session" CTA straight to the real booking route —
   * brief section 10's own preferred "Option A" (no redundant auth
   * friction for someone who's already signed in), chosen because
   * /login and /register are both in this codebase's real
   * AUTH_ONLY_PATHS (src/lib/supabase/middleware.ts): an already
   * authenticated visitor hitting either is bounced straight to
   * /dashboard by middleware BEFORE any `next` intent could be honored,
   * so linking an authenticated visitor through /login here would
   * silently lose their booking intent. See
   * UX10-DS02_REFERENCE_AUDIT.md section 6 for the full writeup.
   */
  isAuthenticated: boolean;
}

export function DiscoveryEntryHero({ isAuthenticated }: DiscoveryEntryHeroProps) {
  const decorative = getGraphicAriaProps({ kind: "decorative" });

  return (
    <section className="relative isolate overflow-hidden bg-background">
      <img {...decorative} src="/hero/campus-sky-backdrop.png" alt="" loading="eager" className="hero-campus-backdrop" />
      <div {...decorative} className="hero-backdrop-scrim" />
      <div {...decorative} className="hero-bottom-fade" />

      <Container className="relative pt-10 pb-6 sm:pt-14 sm:pb-8 lg:pt-16">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1fr] lg:gap-14">
          <div className={cn(FADE_UP_CLASSES, "lg:self-center")}>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary">
              Free · No pressure · Get clarity
            </p>

            <h1 className="mt-5 font-sans text-[2.25rem] font-bold leading-[1.1] tracking-tight balance sm:text-[2.75rem] lg:text-[3.1rem] lg:leading-[1.07]">
              <span className="text-text">Book your free </span>
              <span className="text-primary">Discovery Session</span>
            </h1>

            <p className="mt-5 max-w-lg text-lg leading-relaxed text-text-soft">
              Get personalised guidance from a Nextwise counsellor to help you make confident decisions about your
              career, courses and study options in India and Europe.
            </p>

            {isAuthenticated ? (
              <div className="mt-8">
                <LinkButton
                  href="/discovery-session/book"
                  size="lg"
                  trailingIcon={
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                    />
                  }
                  className={cn("group", HOVER_LIFT_CLASSES)}
                >
                  Book Free Session
                </LinkButton>
              </div>
            ) : (
              <>
                <div className="mt-8 flex flex-row flex-wrap gap-3">
                  <LinkButton
                    href="/register?next=/discovery-session/book"
                    size="lg"
                    trailingIcon={<UserPlus aria-hidden="true" className="h-4 w-4" />}
                    className={cn("group", HOVER_LIFT_CLASSES)}
                  >
                    Create Free Account
                  </LinkButton>
                  <LinkButton
                    href="/login?next=/discovery-session/book"
                    size="lg"
                    variant="outline"
                    icon={<LogIn aria-hidden="true" className="h-4 w-4" />}
                    className={cn(HOVER_LIFT_CLASSES, "!bg-white/90 backdrop-blur-sm")}
                  >
                    Sign In
                  </LinkButton>
                </div>
                <p className="mt-4 text-sm text-text-soft">
                  Already have an account?{" "}
                  <Link
                    href="/login?next=/discovery-session/book"
                    className="font-medium text-secondary-dark underline underline-offset-2"
                  >
                    Sign in instead
                  </Link>
                  .
                </p>
              </>
            )}

            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3">
              {TRUST_ROW.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-sm font-medium text-text-soft">
                  <Icon aria-hidden="true" className="h-4 w-4 text-secondary" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className={cn(FADE_UP_CLASSES, "relative lg:self-end")}>
            <div className="careers-hero-stage relative">
              <div {...decorative} className="careers-hero-atmosphere" />
              <div {...decorative} className="careers-hero-portrait">
                <img
                  src="/hero/nextwise-student-cutout.png"
                  alt=""
                  width={1086}
                  height={1448}
                  loading="eager"
                  className="careers-hero-portrait-img"
                />
              </div>

              {QUESTION_BUBBLES.map(({ label, className }) => (
                <span
                  key={label}
                  aria-hidden="true"
                  className={cn(
                    "absolute z-20 hidden rounded-full border border-border/70 bg-white/90 px-3.5 py-2 text-xs font-medium text-text-soft shadow-soft backdrop-blur-sm lg:block",
                    className
                  )}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
