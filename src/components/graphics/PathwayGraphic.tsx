import type { ComponentType } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { FADE_UP_CLASSES, FLOW_DASH_CLASSES, getStaggerDelayMs } from "@/lib/ui/motion";
import { getGraphicAriaProps, type GraphicAccessibility } from "@/lib/graphics/accessible-graphic";

export type PathwayNodeState = "done" | "current" | "upcoming";

export interface PathwayNode {
  id: string;
  label: string;
  state: PathwayNodeState;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
}

interface PathwayGraphicProps {
  nodes: PathwayNode[];
  orientation?: "horizontal" | "vertical";
  accessibility: GraphicAccessibility;
  className?: string;
  /** Default true. Set false in a context (e.g. a dense table row, or a long list where many of these render at once — see ApplicationCard.tsx) where even one subtle moving line would be one animation too many. */
  animateActiveSegment?: boolean;
  /** Default false. A one-time, staggered fade/rise per node on mount — for a single, prominent usage (e.g. a hero or an empty-state illustration). Left off by default specifically so a page that renders several of these at once (a list of application cards) never ends up with every card's nodes fading in simultaneously, which would read as "animation on every card" rather than one calm entrance. */
  entrance?: boolean;
}

const NODE_TONE_CLASSES: Record<PathwayNodeState, string> = {
  done: "border-primary bg-primary text-on-primary",
  current: "border-primary bg-surface text-primary ring-4 ring-primary/15",
  upcoming: "border-border bg-surface-alt text-muted",
};

const LABEL_TONE_CLASSES: Record<PathwayNodeState, string> = {
  done: "text-text-soft",
  current: "text-primary font-semibold",
  upcoming: "text-muted",
};

/**
 * UX09 Part C — one of this pass's small graphics-system components. A
 * reusable "where am I on this path" visual: a row (or column) of nodes
 * connected by a line, each node in one of exactly three states (done /
 * current / upcoming) supplied by the CALLER from data that already
 * exists (an application's real stage, a dashboard's real next-action
 * grouping) — this component never computes or invents state itself, the
 * same "re-label, never re-derive" discipline UX09 Part A's work-queue
 * module already established.
 *
 * Used for: the homepage hero's illustrative roadmap, the student
 * dashboard's real progress summary, and the applications list/detail
 * pages' real stage-group indicator.
 */
export function PathwayGraphic({
  nodes,
  orientation = "horizontal",
  accessibility,
  className,
  animateActiveSegment = true,
  entrance = false,
}: PathwayGraphicProps) {
  const ariaProps = getGraphicAriaProps(accessibility);
  const isVertical = orientation === "vertical";
  const currentIndex = nodes.findIndex((node) => node.state === "current");

  return (
    <div {...ariaProps} className={className}>
      <div aria-hidden="true" className={cn("flex", isVertical ? "flex-col gap-6" : "flex-col gap-7 sm:flex-row sm:items-start sm:justify-between sm:gap-4")}>
        {nodes.map((node, index) => {
          const Icon = node.icon;
          const isLast = index === nodes.length - 1;
          const segmentIsActive = animateActiveSegment && currentIndex > 0 && index === currentIndex - 1;

          return (
            <div
              key={node.id}
              className={cn(
                "relative flex items-center gap-3",
                isVertical ? "flex-row" : "flex-row sm:flex-1 sm:flex-col sm:text-center sm:gap-2.5",
                entrance && FADE_UP_CLASSES
              )}
              style={entrance ? { animationDelay: `${getStaggerDelayMs(index)}ms` } : undefined}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  NODE_TONE_CLASSES[node.state]
                )}
              >
                {node.state === "done" ? (
                  <Check className="h-4 w-4" />
                ) : Icon ? (
                  <Icon className="h-4 w-4" />
                ) : (
                  <span className={cn("h-2 w-2 rounded-full", node.state === "current" ? "bg-primary" : "bg-border-strong")} />
                )}
              </span>

              <p className={cn("text-xs font-medium leading-snug sm:text-[13px]", LABEL_TONE_CLASSES[node.state])}>{node.label}</p>

              {!isLast ? (
                <svg
                  aria-hidden="true"
                  className={cn(
                    isVertical
                      ? "absolute left-5 top-10 h-6 w-px"
                      : "absolute left-5 top-5 h-6 w-px sm:left-[calc(50%+1.25rem)] sm:top-5 sm:h-px sm:w-[calc(100%-2.5rem)]",
                    segmentIsActive ? "text-primary" : "text-border"
                  )}
                >
                  <line
                    x1={isVertical ? "0.5" : "0"}
                    y1={isVertical ? "0" : "0.5"}
                    x2={isVertical ? "0.5" : "100%"}
                    y2={isVertical ? "100%" : "0.5"}
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeDasharray={segmentIsActive ? "4 4" : undefined}
                    className={segmentIsActive ? FLOW_DASH_CLASSES : undefined}
                  />
                </svg>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
