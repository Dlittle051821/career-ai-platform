import type { Metadata } from "next";
import { publicPageMetadata } from "@/config/seo";
import { LegalDocumentPage } from "@/components/sections/legal/LegalDocumentPage";
import { TERMS_OF_USE } from "@/config/legal";

export const metadata: Metadata = publicPageMetadata("/terms", "Terms of Use", "The terms for using the Nextwise website.");

export default function Page() {
  return <LegalDocumentPage doc={TERMS_OF_USE} />;
}
