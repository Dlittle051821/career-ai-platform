import Image from "next/image";
import type { CSSProperties } from "react";
import { BRAND_MIN_HEIGHT, brandArtwork, type BrandLogoTone, type BrandLogoVariant } from "@/lib/brand/master-logo";

type NextwiseBrandLogoProps = {
  /**
   * full       — N + "extwise" + "Know What's Next." tagline
   * horizontal — N + "extwise"
   * compact    — the horizontal lockup at small sizes, without clear-space padding
   * symbol     — the original N only
   */
  variant?: BrandLogoVariant;
  /** Background the logo sits on. "dark" inks the wordmark for Deep Navy; the N never changes. */
  tone?: BrandLogoTone;
  /** Rendered height in CSS px; the width follows the artwork's proportions. */
  height: number;
  /** Accessible name. Pass "" when the logo sits inside a link that already names it. */
  label?: string;
  priority?: boolean;
  className?: string;
};

/**
 * NW-V5 — the central Nextwise Master Logo v1.0 component. Every variant
 * renders the same approved artwork (see src/lib/brand/master-logo.ts) at its
 * own proportions; nothing is redrawn, stretched or recoloured in CSS.
 *
 * Used by the V5 preview only. Production pages keep their current logo until
 * the website-wide rollout is approved (docs/home-v5/LOGO-USAGE-AUDIT.md).
 */
export function NextwiseBrandLogo({
  variant = "horizontal",
  tone = "light",
  height,
  label = "Nextwise",
  priority = false,
  className,
}: NextwiseBrandLogoProps) {
  const art = brandArtwork(variant, tone);
  const h = Math.max(height, BRAND_MIN_HEIGHT[variant]);
  const w = Math.round((art.width / art.height) * h);
  const pad = variant === "compact" || variant === "symbol" ? 0 : Math.round(h * 0.12);
  const style: CSSProperties = { display: "inline-block", lineHeight: 0, padding: pad };
  return (
    <span className={className} style={style} data-brand-logo={variant} data-brand-tone={tone}>
      <Image src={art.src} alt={label} width={w} height={h} priority={priority} sizes={`${w}px`} draggable={false} />
    </span>
  );
}
