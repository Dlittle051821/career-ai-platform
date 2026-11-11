import { DetailRecordNotice } from "@/components/sections/DetailRecordNotice";

/** CC-24 — rendered with HTTP 404 when no published course matches the URL. */
export default function CourseNotFound() {
  return <DetailRecordNotice kind="not_found" noun="course" browseHref="/courses" browseLabel="Browse the Course Explorer" />;
}
