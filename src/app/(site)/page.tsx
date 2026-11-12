import type { Metadata } from "next";
import { publicPageMetadata } from "@/config/seo";
import { NextwiseV54Home } from "@/components/sections/home/v54/NextwiseV54Home";
import { QuickExplore } from "@/components/sections/home/QuickExplore";

// V5.4 HOMEPAGE — the approved V5.4 landing page: the original N reveal and
// N-led scroll story (one gesture → one complete chapter), the organic
// question cards, Career Intelligence, Study Abroad, Student Studio and the
// closing call to action, full-screen and responsive, with Log in / Sign up.
// It builds on the V4 engine, content and images already in this codebase
// (src/lib/home/v4, src/components/sections/home/v4, public/home-v4), which
// stay unchanged. V4ConnectedHome stays on disk, unreferenced, so this switch
// is a one-file revert. See docs/home-v5-4/IMPLEMENTATION.md.
//
// Public search and sharing metadata are unchanged.
export const metadata: Metadata = publicPageMetadata(
  "/",
  "Career Guidance & Study Abroad",
  "Explore careers, compare courses and universities, and plan study in India or Europe. Start with a free discovery session with NextWise.",
);

// CIUX-01: "Start here" quick routes after the approved story, before the footer.
export default function HomePage() {
  return (
    <>
      <NextwiseV54Home />
      <QuickExplore />
    </>
  );
}
