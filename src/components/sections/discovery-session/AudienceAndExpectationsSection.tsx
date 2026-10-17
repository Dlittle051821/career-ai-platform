import { BookOpen, Compass, FileCheck, Globe2, Info, ShieldCheck, UserCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FADE_UP_CLASSES, getStaggerDelayMs } from "@/lib/ui/motion";

/**
 * UX10-DS01 — "Who should book a Discovery Session?" (5 audience cards)
 * paired with "A few important things to know" (the trust/expectations
 * panel), matching the reference image's layout where these two sections
 * sit side by side.
 *
 * The reference shows 5 flat illustrated-avatar portraits for the audience
 * cards. This milestone deliberately uses icon badges instead — consistent
 * with every other card treatment on this page, and because the brief's
 * own non-negotiable rules explicitly forbid inventing fake student/
 * counsellor identities. An icon + descriptive title carries the same
 * meaning without implying these are real people. Documented as a
 * deliberate deviation in UX10-DS01_REFERENCE_AUDIT.md.
 *
 * The expectations panel is this milestone's single most important trust
 * surface — explicit "no admission guarantee" / "no visa guarantee"
 * language sits here, phrased as reassurance (an info icon, not a warning
 * triangle) rather than legal fine print, per the brief's own instruction.
 */

const AUDIENCE_CARDS: { icon: LucideIcon; label: string }[] = [
  { icon: Compass, label: "Students confused about career options" },
  { icon: Globe2, label: "Students deciding between India and Europe" },
  { icon: BookOpen, label: "Students unsure about courses or universities" },
  { icon: UserCheck, label: "Students who want a profile review" },
  { icon: Users, label: "Parents who want expert guidance and clarity" },
];

const EXPECTATIONS = [
  { icon: ShieldCheck, label: "The session is completely free" },
  { icon: ShieldCheck, label: "There is no pressure to buy any plan" },
  { icon: Info, label: "We do not provide an admission guarantee" },
  { icon: Info, label: "We do not provide a visa guarantee" },
  { icon: FileCheck, label: "Guidance is based on your profile and trusted, official sources" },
  { icon: Users, label: "Parents are welcome to join" },
  { icon: Compass, label: "We may recommend next steps if relevant for you" },
];

export function AudienceAndExpectationsSection() {
  return (
    <Section tone="surface" className="!py-10 sm:!py-12 lg:!py-16">
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
        <div>
          <SectionHeading
            eyebrow="Is this for you?"
            title="Who should book a Discovery Session?"
            description="This session is designed for students and parents who want clarity before their next step."
          />
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {AUDIENCE_CARDS.map(({ icon: Icon, label }, index) => (
              <Card
                key={label}
                className={FADE_UP_CLASSES}
                style={{ animationDelay: `${getStaggerDelayMs(index)}ms` }}
                padded={false}
              >
                <div className="flex h-full flex-col items-center gap-2 p-4 text-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-light">
                    <Icon aria-hidden="true" className="h-4 w-4 text-secondary-dark" />
                  </span>
                  <p className="text-xs font-medium leading-snug text-text">{label}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <SectionHeading eyebrow="No surprises" title="A few important things to know" />
          <Card className="mt-6">
            <ul className="space-y-4">
              {EXPECTATIONS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-start gap-3 text-sm leading-relaxed text-text-soft">
                  <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </Section>
  );
}
