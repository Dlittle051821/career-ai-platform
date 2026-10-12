import Link from "next/link";
import { Building2, Compass, GraduationCap, Lightbulb, Rocket, UserCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getGraphicAriaProps } from "@/lib/graphics/accessible-graphic";

/**
 * UX10-H01 — "Hero Orbit Motion". Replaces HeroProductPreview.tsx as the
 * hero's right-side visual (HeroProductPreview.tsx itself is left on disk
 * unmodified and unreferenced here — see this milestone's completion
 * report for why the file isn't deleted: src/config/site.test.ts-style
 * existing-file guards and the homepage-source-audit test both still read
 * it directly by filename).
 *
 * Six journey cards travel a continuous, slow, elliptical orbit — pure
 * CSS (see the "UX10-H01" keyframe block in globals.css), no animation
 * library. Depth (which card currently reads as "foreground") emerges
 * from scale/opacity/blur/shadow/z-index alone, eased smoothly; angular
 * travel itself stays strictly linear, per the brief's own split
 * ("linear for orbital travel BUT foreground emphasis should ease
 * smoothly"). No card is ever marked "selected" — there is no selection
 * state at all, only continuous depth.
 *
 * Icon choices deliberately REUSE this codebase's existing icon-to-concept
 * mapping rather than the brief's own suggested icons, to keep one
 * consistent semantic system sitewide: Compass already means "Career"
 * (DiscoveryPillars.tsx, HeroProductPreview.tsx), GraduationCap already
 * means "Course", Building2 already means "University", UserCheck already
 * means "Guidance/Trusted Guidance". Two new, non-colliding icons cover
 * the two stages with no existing icon: Lightbulb (Interests — discovery/
 * self-insight) and Rocket (Your Future — the aspirational finish).
 *
 * Routes — every href below is a real, pre-existing, PUBLIC (no-login-
 * required) route; none were invented. Two deliberately point at the same
 * place:
 *   Interests  -> /career-discovery (the one real self-discovery/
 *                 orientation page in the codebase — "Understand your
 *                 direction before you choose a course" — and already the
 *                 primary hero CTA's own destination, so reusing it here
 *                 is intentional, not an oversight: Interests marks where
 *                 the journey starts, Your Future marks where it leads,
 *                 and today there is exactly one real tool for both ends
 *                 of that loop. This also matches the brief's own listed
 *                 fallback for "Your Future" — "exploration CTA").
 *   Career     -> /careers
 *   Course     -> /courses
 *   University -> /universities
 *   Guidance   -> /book-counselling (public; NOT /discovery-session/book,
 *                 which is behind PROTECTED_PATHS and would bounce a
 *                 logged-out visitor straight to /login — same choice
 *                 DiscoveryPillars.tsx already made for the same reason)
 *   Your Future -> /career-discovery (see above — /roadmap and
 *                 /recommendations, the brief's other two suggestions,
 *                 are BOTH in src/lib/supabase/middleware.ts's
 *                 PROTECTED_PATHS and would also redirect a guest to
 *                 /login, so neither is a safe public homepage link)
 */
interface OrbitStage {
  icon: LucideIcon;
  title: string;
  label: string;
  href: string;
  tone: "soft-blue" | "soft-pink" | "soft-mint" | "soft-lavender" | "soft-cyan";
}

const STAGES: OrbitStage[] = [
  { icon: Lightbulb, title: "Interests", label: "Discover you", href: "/career-discovery", tone: "soft-cyan" },
  { icon: Compass, title: "Career", label: "Explore paths", href: "/careers", tone: "soft-blue" },
  { icon: GraduationCap, title: "Course", label: "Find courses", href: "/courses", tone: "soft-pink" },
  { icon: Building2, title: "University", label: "Compare globally", href: "/universities", tone: "soft-mint" },
  { icon: UserCheck, title: "Guidance", label: "Get expert advice", href: "/book-counselling", tone: "soft-lavender" },
  { icon: Rocket, title: "Your Future", label: "Make it happen", href: "/career-discovery", tone: "soft-cyan" },
];

const TONE_STYLE: Record<OrbitStage["tone"], { bg: string; fg: string }> = {
  "soft-blue": { bg: "var(--surface-soft-blue)", fg: "var(--surface-soft-blue-strong)" },
  "soft-pink": { bg: "var(--surface-soft-pink)", fg: "var(--surface-soft-pink-strong)" },
  "soft-mint": { bg: "var(--surface-soft-mint)", fg: "var(--surface-soft-mint-strong)" },
  "soft-lavender": { bg: "var(--surface-soft-lavender)", fg: "var(--surface-soft-lavender-strong)" },
  "soft-cyan": { bg: "var(--surface-soft-cyan)", fg: "var(--surface-soft-cyan-strong)" },
};

export function OrbitJourney() {
  const decorative = getGraphicAriaProps({ kind: "decorative" });

  return (
    <div className="relative">
      {/* Same restrained atmospheric glow HeroProductPreview.tsx used —
          the brief's own fallback instruction when no student/campus photo
          asset exists in the repo (confirmed: public/ holds only brand/
          logo PNGs): "keep the current existing hero image/visual
          treatment and build the orbit system over/around it." */}
      <div {...decorative} className="pointer-events-none absolute -inset-10 -z-10">
        <div className="absolute -top-6 right-4 h-44 w-44 rounded-full bg-intelligence/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-52 w-52 rounded-full bg-secondary/14 blur-3xl" />
      </div>

      <div className="orbit-stage overflow-visible">
        {/* Decorative orbit path — a thin, faint, slowly-travelling
            gradient stroke. Never visually dominant (opacity 0.4, 1.5px
            stroke), Nextwise Blue -> Cyan per the brief's own "Orbit
            Path" section. Reuses the existing .animate-flow-dash
            primitive (already motion-reduce-safe) for the "soft
            highlight travelling through the orbit" detail rather than
            inventing a new ambient keyframe. */}
        <svg {...decorative} className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <linearGradient id="orbit-path-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#22C7F2" />
            </linearGradient>
          </defs>
          <ellipse
            cx="50%"
            cy="50%"
            fill="none"
            strokeWidth={1.5}
            strokeDasharray="1 13"
            className="orbit-path-stroke animate-flow-dash motion-reduce:animate-none"
          />
        </svg>

        <div className="orbit-ellipse absolute inset-0">
          {STAGES.map((stage, index) => {
            const style = TONE_STYLE[stage.tone];
            const delayFraction = -(index / STAGES.length);
            return (
              <Link
                key={stage.title}
                href={stage.href}
                className="orbit-item orbit-arm"
                style={
                  {
                    "--orbit-delay": `calc(var(--orbit-duration) * ${delayFraction.toFixed(4)})`,
                    "--orbit-static-angle": `${(index * 360) / STAGES.length}deg`,
                  } as unknown as React.CSSProperties
                }
              >
                <span className="orbit-counter">
                  <span className="orbit-card-anchor">
                    <span className="orbit-depth flex flex-col items-center gap-1 rounded-xl border border-border/70 bg-surface/95 px-2.5 py-2.5 text-center shadow-soft backdrop-blur-sm">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full"
                        style={{ backgroundColor: style.bg, color: style.fg }}
                      >
                        <stage.icon aria-hidden="true" className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-[11px] font-semibold leading-tight text-text">{stage.title}</span>
                      <span className="text-[9px] leading-tight text-text-soft">{stage.label}</span>
                    </span>
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
