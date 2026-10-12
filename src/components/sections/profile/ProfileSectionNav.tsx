"use client";

import {
  Award,
  BadgeCheck,
  BookOpen,
  Briefcase,
  ClipboardCheck,
  Compass,
  GraduationCap,
  Heart,
  Target,
  UserRound,
  Wallet,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CompletionResult } from "@/types/student-profile";
import { STEP_TITLES, TOTAL_STEPS } from "./onboarding/useProfileWizard";
import { cn } from "@/lib/utils";

const SECTION_ICONS: LucideIcon[] = [
  UserRound, // 1 About You
  GraduationCap, // 2 Education
  BookOpen, // 3 Subject Strengths
  Heart, // 4 Interests
  Wrench, // 5 Skills
  Briefcase, // 6 Work Preferences
  Target, // 7 Career Priorities
  Compass, // 8 Career Goals
  Award, // 9 Study & Location (re-used below with a dedicated icon instead)
  Wallet, // 10 Budget & Funding
  Award, // 11 Experience
];

const STEP_DESCRIPTIONS: Record<number, string> = {
  1: "Who you are and where you're starting from.",
  2: "Your current or most recent education.",
  3: "How strong you are in each subject.",
  4: "What genuinely interests you.",
  5: "Skills you already bring.",
  6: "How you like to work.",
  7: "What matters most in a career.",
  8: "Your direction, even if still forming.",
  9: "Where you're open to studying or working.",
  10: "Your study budget and funding.",
  11: "Internships, projects, and more (optional).",
  12: "Everything you've told us, in one place.",
};

/**
 * UX10-P01 — "Profile Sections" left-column navigation. The reference
 * mockup's own 7 example sections (Personal Information, Academic
 * Background, Interests & Goals, Budget & Preferences, Preferred
 * Destinations, Parent Input, Documents) don't match this product's real
 * profile domain, which has 11 granular sections plus a Review step (see
 * `completion.ts` / `useProfileWizard.tsx`'s own `STEP_TITLES`) — and two
 * of the mockup's own sections (Parent Input, Documents) have NO backing
 * data or logic anywhere in this codebase (confirmed by a full repository
 * search during this milestone's audit). Per the brief's own explicit
 * instruction ("map the reference structure to the closest real product
 * fields... DO NOT DROP REAL EXISTING FIELDS JUST TO MATCH THE
 * screenshot... if a reference field is unsupported: omit it"), this nav
 * uses the real 11 sections + Review, and Parent Input/Documents are
 * omitted rather than fabricated — see this milestone's own completion
 * report for the full reasoning.
 */
export function ProfileSectionNav({
  completion,
  activeStep,
  onSelect,
}: {
  completion: CompletionResult;
  activeStep: number;
  onSelect: (step: number) => void;
}) {
  const items = completion.sections.map((section, index) => ({
    step: index + 1,
    label: section.label,
    complete: section.complete,
    icon: SECTION_ICONS[index] ?? UserRound,
  }));
  items.push({ step: TOTAL_STEPS, label: STEP_TITLES[TOTAL_STEPS], complete: false, icon: ClipboardCheck });

  return (
    <nav aria-label="Profile sections" className="rounded-[1.5rem] border border-border bg-surface p-4 shadow-soft sm:p-5">
      <p className="px-1 font-sans text-base font-semibold text-text">Profile Sections</p>

      {/* Mobile / tablet: horizontal snap-scroll pill selector — same
          scroll-snap + trailing-spacer + edge-fade pattern UX10-D01's
          JourneyTracker already established for exactly this "many items,
          not enough width" situation, preserving progress visibility
          without a vertical stepper that wouldn't fit. */}
      <div className="relative mt-3 lg:hidden">
        <ol className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.step === activeStep;
            return (
              <li key={item.step} className="shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => onSelect(item.step)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3.5 py-2 text-left text-sm font-medium transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : item.complete
                        ? "border-success/30 bg-success-light text-success"
                        : "border-border bg-surface-alt text-text-soft"
                  )}
                >
                  {item.complete && !active ? (
                    <BadgeCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
                  ) : (
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  )}
                  {item.label}
                </button>
              </li>
            );
          })}
          <li aria-hidden="true" className="shrink-0 basis-2" />
        </ol>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent" />
      </div>

      {/* Desktop: vertical connected stepper */}
      <ol className="mt-3 hidden lg:block">
        {items.map((item, index) => {
          const Icon = item.icon;
          const active = item.step === activeStep;
          const isLast = index === items.length - 1;
          return (
            <li key={item.step} className="relative flex gap-3 pb-5 last:pb-0">
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={cn("absolute left-[1.1rem] top-9 h-[calc(100%-0.75rem)] w-px", item.complete ? "bg-primary/30" : "bg-border")}
                />
              ) : null}
              <button
                type="button"
                onClick={() => onSelect(item.step)}
                aria-current={active ? "step" : undefined}
                className="group flex w-full items-start gap-3 rounded-xl p-1 text-left"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    item.complete
                      ? "border-primary bg-primary text-on-primary"
                      : active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border-strong bg-surface text-muted"
                  )}
                >
                  {item.complete ? <BadgeCheck aria-hidden="true" className="h-4.5 w-4.5" /> : <Icon aria-hidden="true" className="h-4 w-4" />}
                </span>
                <span
                  className={cn(
                    "min-w-0 rounded-xl px-2.5 py-1.5 transition-colors",
                    active ? "bg-primary/10" : "group-hover:bg-surface-alt"
                  )}
                >
                  <span className={cn("block text-sm font-semibold", active ? "text-primary" : "text-text")}>
                    {item.label}
                    <span className="sr-only">{item.complete ? " — complete" : active ? " — in progress" : " — not started"}</span>
                  </span>
                  <span className="block text-xs text-muted">{STEP_DESCRIPTIONS[item.step]}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
