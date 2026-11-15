import type { EuropeCountryCode } from "@/data/europe-explorer";

/**
 * National flags, drawn inline to their official layouts and colours (no
 * image request, no third-party asset). Decorative next to a visible country
 * name, so hidden from assistive technology.
 */
const FLAG_PARTS: Record<EuropeCountryCode, React.ReactNode> = {
  DE: (<><rect width="30" height="7" fill="#000" /><rect y="7" width="30" height="7" fill="#DD0000" /><rect y="14" width="30" height="7" fill="#FFCE00" /></>),
  IE: (<><rect width="10" height="21" fill="#169B62" /><rect x="10" width="10" height="21" fill="#fff" /><rect x="20" width="10" height="21" fill="#FF883E" /></>),
  NL: (<><rect width="30" height="7" fill="#AE1C28" /><rect y="7" width="30" height="7" fill="#fff" /><rect y="14" width="30" height="7" fill="#21468B" /></>),
  FR: (<><rect width="10" height="21" fill="#0055A4" /><rect x="10" width="10" height="21" fill="#fff" /><rect x="20" width="10" height="21" fill="#EF4135" /></>),
  SE: (<><rect width="30" height="21" fill="#006AA7" /><rect x="8.4" width="4.2" height="21" fill="#FECC00" /><rect y="8.4" width="30" height="4.2" fill="#FECC00" /></>),
  DK: (<><rect width="30" height="21" fill="#C8102E" /><rect x="9" width="3.4" height="21" fill="#fff" /><rect y="8.8" width="30" height="3.4" fill="#fff" /></>),
};

export function CountryFlag({ code, size = "md" }: { code: EuropeCountryCode; size?: "md" | "lg" }) {
  return (
    <span className="ud-flag" data-size={size} aria-hidden="true">
      <svg viewBox="0 0 30 21" focusable="false">{FLAG_PARTS[code]}</svg>
    </span>
  );
}
