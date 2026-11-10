import type { V54Icon } from "@/lib/home/v54/config";

/** One family of 1.75-stroke line icons for the question cards (drawn for Nextwise; no third-party icon set). */
const PATHS: Record<V54Icon, string> = {
  book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Zm0 15A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5Z",
  cap: "M2.5 9 12 4.5 21.5 9 12 13.5 2.5 9Zm4 2.2V16c1.4 1.4 3.3 2 5.5 2s4.1-.6 5.5-2v-4.8M21.5 9v5",
  shield: "M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Zm-3 9 2.2 2.2L15.5 10",
  coins: "M9 10.5c3.3 0 6-1.3 6-3s-2.7-3-6-3-6 1.3-6 3 2.7 3 6 3Zm-6-3v4.5c0 1.7 2.7 3 6 3s6-1.3 6-3V7.5M3 12v4.5c0 1.7 2.7 3 6 3 1.2 0 2.3-.2 3.2-.5M15 12.2c3.1.2 6 1.4 6 3.1v0c0 1.7-2.7 3-6 3",
  check: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-4 9.2 2.8 2.8L16.2 9.6",
  bars: "M4 20h16M7 16.5v-5M12 16.5V7M17 16.5v-8",
  trend: "M3.5 17.5 9.5 11.5l4 4 7-7.5M15 8h5.5v5.5",
  compass: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.8 5.2-2.2 5.4-5.4 2.2 2.2-5.4 5.4-2.2Z",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3Z",
};

export function V54IconGlyph({ name, size = 22 }: { name: V54Icon; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
