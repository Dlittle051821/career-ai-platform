import { cn } from "@/lib/utils";
import { FLOW_DASH_CLASSES } from "@/lib/ui/motion";
import { getGraphicAriaProps, type GraphicAccessibility } from "@/lib/graphics/accessible-graphic";

interface NetworkGraphicProps {
  accessibility: GraphicAccessibility;
  className?: string;
  /** How many possibilities radiate from the center. Default 6. */
  pointCount?: number;
  /** Default true — one spoke gets the same slow, subtle flow-dash motion PathwayGraphic uses for its active segment. Sparing by design: never more than one spoke animates. */
  animate?: boolean;
}

const SATELLITE_TONE_CLASSES = ["text-secondary", "text-accent", "text-intelligence-strong"];

/**
 * UX09 Part C — the second graphics-system component: a small, abstract
 * "one starting point, many directions" network, used as decorative
 * header art wherever the product's own copy is about branching
 * possibilities rather than a single fixed sequence — the
 * career-discovery opening state, and the careers/courses/universities
 * page headers. Deliberately abstract (nothing here claims to represent
 * a specific career, course, or university), so it never risks implying
 * data that isn't there.
 */
export function NetworkGraphic({ accessibility, className, pointCount = 6, animate = true }: NetworkGraphicProps) {
  const ariaProps = getGraphicAriaProps(accessibility);
  const size = 200;
  const center = size / 2;
  const radius = 72;
  const points = Array.from({ length: pointCount }, (_, index) => {
    const angle = (index / pointCount) * Math.PI * 2 - Math.PI / 2;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
      tone: SATELLITE_TONE_CLASSES[index % SATELLITE_TONE_CLASSES.length],
    };
  });

  return (
    <div {...ariaProps} className={className}>
      <svg aria-hidden="true" viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
        {points.map((point, index) => (
          <line
            key={`spoke-${index}`}
            x1={center}
            y1={center}
            x2={point.x}
            y2={point.y}
            stroke="currentColor"
            strokeWidth={1.5}
            strokeDasharray={animate && index === 0 ? "3 5" : undefined}
            className={cn("text-border", animate && index === 0 && FLOW_DASH_CLASSES)}
          />
        ))}
        {points.map((point, index) => (
          <circle key={`node-${index}`} cx={point.x} cy={point.y} r={7} fill="currentColor" className={point.tone} />
        ))}
        <circle cx={center} cy={center} r={11} fill="currentColor" className="text-primary" />
      </svg>
    </div>
  );
}
