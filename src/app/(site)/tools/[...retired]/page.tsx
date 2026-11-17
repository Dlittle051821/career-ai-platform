import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FREE_TOOLS_PATH } from "@/config/upcoming-tools";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Any address under /tools/… — a retired calculator, an old bookmark, a guess
 * at a planned tool — goes to the Coming Soon catalogue. No individual tool
 * has a page. The catalogue itself (/tools) is a different route, so this can
 * never redirect to itself.
 */
export default function RetiredToolRoute() {
  redirect(FREE_TOOLS_PATH);
}
