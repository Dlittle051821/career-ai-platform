import { DetailRecordNotice } from "@/components/sections/DetailRecordNotice";

/** CC-24 — rendered with HTTP 404 when no published career matches the URL. */
export default function CareerNotFound() {
  return <DetailRecordNotice kind="not_found" noun="career" browseHref="/careers" browseLabel="Browse the Career Explorer" />;
}
