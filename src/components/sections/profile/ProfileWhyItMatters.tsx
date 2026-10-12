import Image from "next/image";
import { Lightbulb } from "lucide-react";
import { TOTAL_STEPS } from "./onboarding/useProfileWizard";

const WHY_IT_MATTERS_COPY: Record<number, string> = {
  1: "Knowing your current stage and background helps us tailor every recommendation to where you actually are.",
  2: "Your academic record shapes which courses, universities, and career paths are realistically within reach.",
  3: "The subjects you're strongest in are often the clearest early signal of where you'll naturally excel later.",
  4: "What genuinely interests you keeps you motivated through years of study and work — we weigh this heavily.",
  5: "The skills you already have tell us how ready you are for different types of roles and courses.",
  6: "How you like to work — with people or data, independently or in teams — matters as much as what you study.",
  7: "Salary, stability, flexibility, impact — telling us what matters most helps us rank options the way you would.",
  8: "Even a rough sense of direction helps us narrow thousands of possible paths down to a shortlist worth your time.",
  9: "Where you're willing to study or work changes which universities, countries, and visas are even relevant.",
  10: "Being upfront about your budget means we only ever recommend options that are realistically affordable.",
  11: "Internships, projects, and extracurriculars can strengthen applications and reveal interests test scores can't.",
  [TOTAL_STEPS]: "This is where everything comes together — review what you've told us before your recommendations.",
};

/**
 * UX10-P01 — right column, card 1. Context copy changes per the wizard's
 * active section, per the brief's own worked examples (section 13).
 * `profile-why-matters.png` is the real provided illustration asset,
 * cropped from the approved reference mockup itself and stored at
 * `public/profile/profile-why-matters.png` — used here exactly the way
 * the brief's own section 16 prescribes ("contextual sections / decorative
 * accents"), not as a stand-in for any real student data.
 */
export function ProfileWhyItMatters({ step }: { step: number }) {
  return (
    <section aria-labelledby="why-matters-heading" className="overflow-hidden rounded-[1.5rem] border border-border bg-surface shadow-soft">
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
              <Lightbulb aria-hidden="true" className="h-4 w-4" />
            </span>
            <h2 id="why-matters-heading" className="font-sans text-base font-semibold text-text">
              Why This Matters
            </h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-text-soft">{WHY_IT_MATTERS_COPY[step] ?? WHY_IT_MATTERS_COPY[1]}</p>
        </div>
        <div className="relative hidden h-24 w-20 shrink-0 overflow-hidden rounded-xl sm:block" aria-hidden="true">
          <Image src="/profile/profile-why-matters.png" alt="" fill sizes="80px" className="object-cover object-top" />
        </div>
      </div>
    </section>
  );
}
