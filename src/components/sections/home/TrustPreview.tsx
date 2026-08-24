import { ArrowRight, Check, FileText, Receipt, ScrollText, ShieldAlert, ShieldOff } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LinkButton } from "@/components/ui/Button";

const POINTS = [
  { icon: FileText, text: "Clear service scope before payment" },
  { icon: Receipt, text: "Itemised fee and receipt process" },
  { icon: ScrollText, text: "Transparent refund conditions" },
  { icon: ShieldOff, text: "No false guarantees, ever" },
  { icon: ShieldAlert, text: "Recommendation and commission disclosure" },
  { icon: Check, text: "Clear complaint escalation path" },
];

export function TrustPreview() {
  return (
    <Section tone="muted">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <SectionHeading
          eyebrow="Trust, made visible"
          title="Trust should be verifiable, not requested"
          description="Parents shouldn't have to take our word for it. Here's what we intend to make visible before you ever pay."
        />
        <ul className="grid gap-4 sm:grid-cols-2">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 rounded-[var(--radius-control)] border border-border bg-surface p-4">
              <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
              <span className="text-sm font-medium text-text-soft">{text}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-8">
        <LinkButton href="/trust" trailingIcon={<ArrowRight aria-hidden="true" className="h-4 w-4" />}>
          Visit our Trust Center
        </LinkButton>
      </div>
    </Section>
  );
}
