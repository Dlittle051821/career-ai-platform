import type { Metadata } from "next";
import { LegalPlaceholder } from "@/components/sections/legal/LegalPlaceholder";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "What our future Refund Policy will cover — pending professional legal review before launch.",
};

const CATEGORIES = [
  { title: "Refund eligibility", description: "The circumstances under which a refund may apply, stage by stage." },
  { title: "How to request a refund", description: "The intended process: request, acknowledgement, review, written decision." },
  { title: "Timelines", description: "How quickly requests will be acknowledged and resolved." },
  { title: "Non-refundable items", description: "Any third-party costs (for example, application or visa fees) that would not be refundable." },
  { title: "Cancellation terms", description: "What happens if you cancel a package partway through." },
  { title: "Dispute process", description: "What to do if you disagree with a refund decision." },
];

export default function RefundPolicyPage() {
  return (
    <LegalPlaceholder
      eyebrow="Legal"
      title="Refund Policy"
      intro="This page outlines what our Refund Policy will cover. The final policy, including exact conditions and timelines, will be published after professional legal review."
      categories={CATEGORIES}
      breadcrumbLabel="Refund Policy"
    />
  );
}
