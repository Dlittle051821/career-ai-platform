import Link from "next/link";
import { FileWarning } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHero } from "@/components/sections/PageHero";
import { LEGAL_REVIEW, type LegalDocument } from "@/config/legal";
import { OFFICIAL_CONTACT } from "@/config/contact";

/**
 * V5.6.2 public launch: renders the Privacy Policy, Terms of Use and Refund
 * Policy from src/config/legal.ts. While the text is a draft, the page says so
 * plainly at the top; it never presents a draft as approved or in effect.
 */
export function LegalDocumentPage({ doc }: { doc: LegalDocument }) {
  const draft = LEGAL_REVIEW.status !== "approved";
  return (
    <>
      <PageHero
        size="compact"
        eyebrow="Legal"
        title={doc.title}
        description={doc.summary}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: doc.title }]}
      >
        {draft ? (
          <Badge tone="warning">Draft · under legal review</Badge>
        ) : (
          <p className="text-sm text-text-soft">Effective {LEGAL_REVIEW.effectiveDate}</p>
        )}
      </PageHero>

      <Section tone="surface">
        <div className="mx-auto max-w-3xl">
          {draft ? (
            <Card className="flex items-start gap-3 border-warning/25 bg-warning-light">
              <FileWarning aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <p className="text-sm leading-relaxed text-text-soft" data-testid="legal-draft-notice">
                This is a draft dated {LEGAL_REVIEW.draftedOn}. It describes how the website works today, but it has not
                yet been reviewed by a lawyer or approved by Nextwise, and it is not yet in effect.
              </p>
            </Card>
          ) : null}

          <div className="mt-10 space-y-10">
            {doc.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl font-semibold text-primary">{section.heading}</h2>
                {section.paragraphs.map((p) => (
                  <p key={p} className="mt-3 text-[15px] leading-relaxed text-text-soft">
                    {p}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-text-soft">
                    {section.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <p className="mt-12 border-t border-border pt-6 text-sm text-muted">
            {draft ? `Draft dated ${LEGAL_REVIEW.draftedOn}.` : `Effective ${LEGAL_REVIEW.effectiveDate}.`} Questions? Email{" "}
            <a href={OFFICIAL_CONTACT.founder.mailto} className="text-secondary-dark underline underline-offset-2">
              {OFFICIAL_CONTACT.founder.email}
            </a>{" "}
            or see{" "}
            <Link href="/contact" className="text-secondary-dark underline underline-offset-2">
              Contact
            </Link>
            .
          </p>
        </div>
      </Section>
    </>
  );
}
