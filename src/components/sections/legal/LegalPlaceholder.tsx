import Link from "next/link";
import { FileWarning } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { PageHero } from "@/components/sections/PageHero";
import { Badge } from "@/components/ui/Badge";
import { LEGAL_STATUS } from "@/config/site";

interface LegalPlaceholderProps {
  eyebrow: string;
  title: string;
  intro: string;
  categories: { title: string; description: string }[];
  breadcrumbLabel: string;
}

/** Shared structure for Privacy, Terms, and Refund Policy placeholder pages. */
export function LegalPlaceholder({ eyebrow, title, intro, categories, breadcrumbLabel }: LegalPlaceholderProps) {
  return (
    <>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        description={intro}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: breadcrumbLabel }]}
      >
        <Badge tone="warning">Pending professional legal review</Badge>
      </PageHero>

      <Section tone="surface">
        <Card className="flex items-start gap-3 border-warning/25 bg-warning-light">
          <FileWarning aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-sm leading-relaxed text-text-soft">
            This is a placeholder outlining what the final {title.toLowerCase()} will cover. It is not a complete or
            binding legal document. The final version will be published after professional legal review, before
            commercial launch.
          </p>
        </Card>

        <SectionHeading eyebrow="What this policy will cover" title="Categories" className="mt-10 max-w-none" />
        <div className="mt-6 space-y-4">
          {categories.map((category) => (
            <Card key={category.title}>
              <p className="text-base font-semibold text-primary">{category.title}</p>
              <p className="mt-1 text-sm text-muted">{category.description}</p>
            </Card>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted">
          Last updated: {LEGAL_STATUS.lastUpdated}. Questions about this policy? Visit{" "}
          <Link href="/contact" className="text-secondary-dark underline underline-offset-2">
            Contact
          </Link>{" "}
          or the{" "}
          <Link href="/trust" className="text-secondary-dark underline underline-offset-2">
            Trust Center
          </Link>
          .
        </p>
      </Section>
    </>
  );
}
