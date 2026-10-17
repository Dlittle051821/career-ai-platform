import {
  Banknote,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Globe2,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FADE_UP_CLASSES, getStaggerDelayMs } from "@/lib/ui/motion";

/**
 * UX10-DS01 — "What we'll discuss" (8 compact topic cards) paired side by
 * side with "What you'll receive" (an outcome-oriented panel), matching the
 * reference image's layout where these two sections sit in one row.
 *
 * These 8 cards explain the CONVERSATION — they are explicitly not a form.
 * The real booking form further down this page only collects what the
 * backend actually supports (preferred contact method/time/language and an
 * optional free-text note); none of these 8 topics becomes a new mandatory
 * form field, per the brief's own instruction.
 *
 * "What you'll receive" uses the brief's own neutral fallback wording for
 * the paid-plan-relevance bullet ("Honest advice on whether any Nextwise
 * paid service is relevant for your situation") rather than naming the six
 * real plan SKUs (Nextwise Verified/Essential, Bachelor/Master Abroad
 * Plus/Premium — confirmed real, current plan names in
 * supabase/seed/0009_pr01_new_commercial_catalogue_seed.sql). The brief
 * explicitly allows this fallback when named plans would make a free-
 * session benefits panel read as sales-oriented, which a 6-SKU list inside
 * a "no pressure" page risks doing — documented here and in
 * UX10-DS01_REFERENCE_AUDIT.md as a deliberate, deviation, not an
 * oversight.
 */

const DISCUSSION_TOPICS: { icon: LucideIcon; label: string }[] = [
  { icon: Sparkles, label: "Your interests and strengths" },
  { icon: BookOpen, label: "Academic background" },
  { icon: Target, label: "Career and course goals" },
  { icon: Banknote, label: "Budget and affordability" },
  { icon: Globe2, label: "Preferred countries (India / Europe)" },
  { icon: Users, label: "Parent expectations" },
  { icon: CalendarClock, label: "Timeline and next steps" },
  { icon: HelpCircle, label: "Your key uncertainties" },
];

const OUTCOMES = [
  "A clearer understanding of your options",
  "Initial career and study-pathway guidance",
  "Personalised next-step recommendations",
  "Honest advice on whether any Nextwise paid service is relevant for your situation",
];

export function DiscussionAndOutcomesSection() {
  return (
    <Section tone="default" className="!py-10 sm:!py-12 lg:!py-16">
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
        <div>
          <SectionHeading
            eyebrow="The conversation"
            title="What we'll discuss"
            description="We'll focus on the topics that matter most to you."
          />
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {DISCUSSION_TOPICS.map(({ icon: Icon, label }, index) => (
              <Card
                key={label}
                className={FADE_UP_CLASSES}
                style={{ animationDelay: `${getStaggerDelayMs(index)}ms` }}
                padded={false}
              >
                <div className="flex h-full flex-col items-center gap-2 p-4 text-center">
                  <Icon aria-hidden="true" className="h-5 w-5 text-secondary" />
                  <p className="text-xs font-medium leading-snug text-text">{label}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <SectionHeading eyebrow="The outcome" title="What you'll receive" />
          <Card className="mt-6 bg-surface-alt">
            <ul className="space-y-4">
              {OUTCOMES.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-text-soft">
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted">
              <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              This free session is separate from any paid plan — there is no obligation to purchase anything.
            </p>
          </Card>
        </div>
      </div>
    </Section>
  );
}
