import Link from "next/link";
import Image from "next/image";
import { BRAND_LOGO, BRAND_NAME } from "@/config/site";

/**
 * Site-wide logo lockup: the official NextWise icon mark (transparent PNG,
 * public/brand/nextwise-icon.png) plus a code-rendered wordmark.
 *
 * Deliberately NOT the flattened full-lockup image (public/brand/
 * nextwise-logo-horizontal*.png) here: that asset bakes its own background
 * (transparent-with-navy-text, or opaque-navy-with-white-text) directly
 * into the PNG, which only reads correctly on the exact surface it was
 * designed for. This component is reused on both light surfaces (header,
 * auth pages — bg-surface/bg-surface-alt) and a dark navy surface (footer,
 * admin sidebar — bg-primary, #1c2b4a) that doesn't exactly match either
 * baked-in background, so a flattened asset would show a visible edge.
 * Using the icon (which reads fine on both light and dark) plus a
 * CSS-colored wordmark sidesteps that mismatch without cropping or
 * recoloring the supplied artwork itself. The full flattened lockups are
 * used where the surrounding background is fixed and known: the invoice
 * PDF header (white) and the Open Graph/social share image (its own navy
 * canvas) — see src/lib/payments/pdf.ts and public/brand/
 * nextwise-social-share.png.
 */
export function Logo({ onDark = false }: { onDark?: boolean }) {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md py-1 text-lg font-semibold tracking-tight"
      aria-label={`${BRAND_NAME} — home`}
    >
      <Image
        src={BRAND_LOGO.icon}
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 shrink-0"
        priority
      />
      <span className={onDark ? "text-on-primary" : "text-primary"}>{BRAND_NAME}</span>
    </Link>
  );
}
