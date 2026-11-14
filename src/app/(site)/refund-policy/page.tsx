import type { Metadata } from "next";
import { publicPageMetadata } from "@/config/seo";
import { LegalDocumentPage } from "@/components/sections/legal/LegalDocumentPage";
import { REFUND_POLICY } from "@/config/legal";

export const metadata: Metadata = publicPageMetadata("/refund-policy", "Refund Policy", "How refunds work for Nextwise services.");

export default function Page() {
  return <LegalDocumentPage doc={REFUND_POLICY} />;
}
