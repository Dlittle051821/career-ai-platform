import { DetailRecordNotice } from "@/components/sections/DetailRecordNotice";

/** CC-24 — rendered with HTTP 404 when no published university matches the URL. */
export default function UniversityNotFound() {
  return <DetailRecordNotice kind="not_found" noun="university" browseHref="/universities" browseLabel="Browse the University Explorer" />;
}
