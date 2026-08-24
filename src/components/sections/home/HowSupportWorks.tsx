import { MessageCircle, Target, Wallet } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { DemoNotice } from "@/components/ui/DemoNotice";

const STEPS = [
  { icon: Target, title: "Share your goals", description: "Tell us about your interests, academics, and what you're weighing up." },
  { icon: MessageCircle, title: "Have an initial conversation", description: "A free, no-obligation conversation to understand your situation and answer questions." },
  { icon: Wallet, title: "Choose paid support, or not", description: "Decide if and when you want structured paid support — entirely your call." },
];

export function HowSupportWorks() {
  return (
    <Section tone="default">
      <SectionHeading
        eyebrow="How support works"
        title="A simple, no-pressure way to get started"
      />
      <ol className="mt-10 grid gap-6 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, description }, index) => (
          <li key={title}>
            <Card className="h-full">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary text-sm font-semibold">
                  {index + 1}
                </span>
                <Icon aria-hidden="true" className="h-5 w-5 text-secondary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-primary">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
            </Card>
          </li>
        ))}
      </ol>
      <DemoNotice className="mt-8">
        Booking the initial conversation does not oblige you to purchase any package.
      </DemoNotice>
    </Section>
  );
}
