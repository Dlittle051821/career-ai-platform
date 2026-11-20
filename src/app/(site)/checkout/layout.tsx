import type { Metadata } from "next";
import { notFoundInPublicMarketingMode } from "@/lib/launch/server-gate";
import { v54Grotesk } from "@/components/sections/home/v54/fonts";
import "@/styles/payment-v1.css";

/** NW-PAYMENT-V1 — package checkout. Private, never indexed, and absent in public-launch mode. */
export const metadata: Metadata = {
  title: "Secure checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  notFoundInPublicMarketingMode();
  return <div className={`nwp-app ${v54Grotesk.variable}`}>{children}</div>;
}
