import type { Metadata } from "next";
import { LegalPlaceholder } from "@/components/sections/legal/LegalPlaceholder";
import { BRAND_NAME } from "@/config/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "What our future Terms of Service will cover — pending professional legal review before launch.",
};

const CATEGORIES = [
  { title: "Acceptance of terms", description: "How using the site or services indicates agreement to the terms." },
  { title: "Service description", description: `A clear description of what ${BRAND_NAME} does and does not provide.` },
  { title: "User responsibilities", description: "What we expect from students, parents, and partners using the platform." },
  { title: "Payment terms", description: "How fees, invoicing, and payment timing will work for paid packages." },
  { title: "Intellectual property", description: "Ownership of content, materials, and any tools we provide." },
  { title: "Limitation of liability", description: "The boundaries of what we are and are not responsible for, particularly around outcomes." },
  { title: "Service changes", description: "How we handle updates to packages, pricing, or scope over time." },
  { title: "Termination", description: "Conditions under which service to a user may end." },
  { title: "Dispute resolution", description: "The intended process for resolving disagreements before escalation." },
  { title: "Governing law", description: "Which jurisdiction's laws apply to the agreement." },
];

export default function TermsPage() {
  return (
    <LegalPlaceholder
      eyebrow="Legal"
      title="Terms of Service"
      intro="This page outlines what our Terms of Service will cover. The final terms will be published after professional legal review."
      categories={CATEGORIES}
      breadcrumbLabel="Terms of Service"
    />
  );
}
