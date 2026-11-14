import type { Metadata } from "next";
import { publicPageMetadata } from "@/config/seo";
import { LegalDocumentPage } from "@/components/sections/legal/LegalDocumentPage";
import { PRIVACY_POLICY } from "@/config/legal";

export const metadata: Metadata = publicPageMetadata("/privacy", "Privacy Policy", "How Nextwise handles information when you visit the website or contact us.");

export default function Page() {
  return <LegalDocumentPage doc={PRIVACY_POLICY} />;
}
