import type { Metadata } from "next";
import { LegalPlaceholder } from "@/components/sections/legal/LegalPlaceholder";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What our future Privacy Policy will cover — pending professional legal review before launch.",
};

const CATEGORIES = [
  { title: "What we collect", description: "The categories of information collected through forms, browsing, and counselling conversations." },
  { title: "Why we collect it", description: "The specific purposes data is used for, and nothing beyond those purposes." },
  { title: "How it's stored and secured", description: "Storage practices and safeguards intended to protect your information." },
  { title: "Who can access it", description: "Which team members or systems can access student and parent data, and under what conditions." },
  { title: "Third-party sharing", description: "Whether and when data is shared with institutions, partners, or service providers." },
  { title: "Cookies and analytics", description: "Any tracking technology used on the site, and your choices around it." },
  { title: "Data retention", description: "How long information is kept and when it is deleted." },
  { title: "Your rights", description: "How to request access to, correction of, or deletion of your data." },
  { title: "Children's data", description: "Special care taken given many users are students under 18." },
  { title: "Contact for privacy queries", description: "Who to reach out to with privacy-related questions." },
];

export default function PrivacyPage() {
  return (
    <LegalPlaceholder
      eyebrow="Legal"
      title="Privacy Policy"
      intro="This page outlines what our Privacy Policy will cover. The final policy will be published after professional legal review."
      categories={CATEGORIES}
      breadcrumbLabel="Privacy Policy"
    />
  );
}
