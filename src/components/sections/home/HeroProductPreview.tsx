import { Bookmark, Building2, Compass, GraduationCap, Home, ListChecks, UserCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { BRAND_NAME } from "@/config/site";
import { getGraphicAriaProps } from "@/lib/graphics/accessible-graphic";

/**
 * UX10A — the hero's floating "product preview" visual.
 *
 * The approved reference image uses a real student photograph alongside a
 * floating dashboard-preview card. No licensed/approved photographic asset
 * exists in this repository (confirmed: public/ contains only brand/logo
 * PNGs — see public/brand/), and the task's own instruction is explicit:
 * "Do not blindly use an unlicensed web image... do not generate/commit
 * random external images. If a suitable hero asset does not exist: create
 * the layout so the visual asset is replaceable, and clearly report the
 * required asset." This component is therefore built the same way this
 * codebase already builds every other homepage visual (RoadmapVisual.tsx:
 * "Original, component-built... no stock imagery") — an illustrative,
 * component-built product-preview card stands as the complete hero visual
 * on its own, with no photo slot to leave visibly empty. See
 * UX10A_VISUAL_QA.md for the recommended future photographic asset.
 *
 * Every value shown is a label or a state word, never a fabricated count —
 * "For logged-out homepage preview: use neutral illustrative values OR
 * omit numeric values. Never imply that preview data is a real user's
 * data" (the task's own rule). The card is explicitly labelled
 * "Illustrative preview" (same convention as RoadmapVisual's "Illustrative
 * journey" badge) rather than "Welcome back, [name]" the way the reference
 * image's preview greets a specific signed-in student.
 */
const NAV_ITEMS = [
  { icon: Home, label: "Home" },
  { icon: UserCircle2, label: "My Profile" },
  { icon: Compass, label: "Career Explorer" },
  { icon: GraduationCap, label: "Course Explorer" },
  { icon: Building2, label: "University Explorer" },
];

const STAT_TILES = [
  { icon: Compass, label: "Career direction", state: "In progress", tone: "soft-blue" as const },
  { icon: Bookmark, label: "Saved courses", state: "Building your list", tone: "soft-pink" as const },
  { icon: Building2, label: "Universities", state: "Shortlisting", tone: "soft-mint" as const },
  { icon: ListChecks, label: "Study plan", state: "In progress", tone: "soft-lavender" as const },
];

const TONE_STYLE: Record<(typeof STAT_TILES)[number]["tone"], { bg: string; fg: string }> = {
  "soft-blue": { bg: "var(--surface-soft-blue)", fg: "var(--surface-soft-blue-strong)" },
  "soft-pink": { bg: "var(--surface-soft-pink)", fg: "var(--surface-soft-pink-strong)" },
  "soft-mint": { bg: "var(--surface-soft-mint)", fg: "var(--surface-soft-mint-strong)" },
  "soft-lavender": { bg: "var(--surface-soft-lavender)", fg: "var(--surface-soft-lavender-strong)" },
};

export function HeroProductPreview() {
  const decorative = getGraphicAriaProps({ kind: "decorative" });

  return (
    <div className="relative">
      {/* Decorative floating accent shapes — purely visual depth, same
          restrained blur-circle treatment GeometricBackdrop already uses
          elsewhere, scoped tight around this card for the "floating"
          composition the reference image shows. */}
      <div {...decorative} className="pointer-events-none absolute -inset-6 -z-10">
        <div className="absolute -top-6 right-4 h-40 w-40 rounded-full bg-intelligence/15 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-lifted sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-primary">{BRAND_NAME} · Student dashboard</p>
          <Badge tone="neutral">Illustrative preview</Badge>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-[9rem_1fr]">
          <nav aria-hidden="true" className="hidden flex-col gap-1 sm:flex">
            {NAV_ITEMS.map(({ icon: Icon, label }, index) => (
              <span
                key={label}
                className={
                  "flex items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium " +
                  (index === 2 ? "bg-surface-alt text-primary" : "text-muted")
                }
              >
                <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </span>
            ))}
          </nav>

          <div>
            <p className="text-sm font-semibold text-text">Here&apos;s what guided discovery looks like</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              A sample of the dashboard every student gets — career direction, saved courses and universities, and a
              personal study plan, all in one place.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {STAT_TILES.map(({ icon: Icon, label, state, tone }) => (
                <div
                  key={label}
                  className="rounded-[var(--radius-control)] p-3"
                  style={{ backgroundColor: TONE_STYLE[tone].bg }}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" style={{ color: TONE_STYLE[tone].fg }} />
                  <p className="mt-1.5 text-[11px] font-semibold leading-tight" style={{ color: TONE_STYLE[tone].fg }}>
                    {label}
                  </p>
                  <p className="text-[11px] text-muted">{state}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2.5 rounded-[var(--radius-control)] border border-border bg-surface-alt/60 p-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--surface-soft-amber)", color: "var(--surface-soft-amber-strong)" }}
              >
                <GraduationCap aria-hidden="true" className="h-4 w-4" />
              </span>
              <p className="text-xs font-medium text-text-soft">Courses matched to your interests, recommended for you</p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-muted">Illustrative preview — not a real student&apos;s data.</p>
      </div>
    </div>
  );
}
