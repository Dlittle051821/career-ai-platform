import Link from "next/link";
import { BRAND_NAME } from "@/config/site";
import { NextwiseBrandLogo } from "@/components/brand/NextwiseBrandLogo";

/**
 * CIUX-01 — every surface now shows the approved Nextwise Master Logo v1.0
 * (src/lib/brand/master-logo.ts), the same artwork as the live homepage
 * header. Light surfaces use the light lockup; dark surfaces (navy footer,
 * admin sidebar) use the dark lockup, which is drawn for Deep Navy, so the
 * old sampled-colour backing plate is no longer needed. The artwork is never
 * redrawn or recoloured. API unchanged (`onDark`).
 */
export function Logo({ onDark = false }: { onDark?: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center rounded-md py-1" aria-label={`${BRAND_NAME} — home`}>
      <NextwiseBrandLogo variant="compact" tone={onDark ? "dark" : "light"} height={34} label="" priority />
    </Link>
  );
}
