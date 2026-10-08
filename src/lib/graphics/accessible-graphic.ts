/**
 * UX09 Part B/C — one small, pure rule every new graphic in
 * src/components/graphics/ goes through, instead of each component
 * re-deciding for itself whether it is decorative or meaningful.
 *
 * The task's own accessibility rule is explicit: "decorative SVG =
 * aria-hidden, meaningful SVG = accessible label." Centralizing the
 * decision as a pure function (rather than an inline ternary copied into
 * three component files) means there is exactly one place that could get
 * this wrong, and it is covered by a unit test instead of three
 * hand-verified JSX blocks.
 *
 * - "decorative": the graphic adds visual texture only (a background
 *   wash, a page-header flourish) and carries no information a screen
 *   reader user would lose by skipping it. Gets `aria-hidden="true"` and
 *   nothing else — never a redundant empty alt/label alongside it.
 * - "meaningful": the graphic communicates real state (a student's
 *   actual progress through a pathway, a real stage sequence). Gets
 *   `role="img"` plus the caller-supplied `label`, which must describe
 *   what the graphic shows in words, not restate that it's a graphic.
 */
export type GraphicAccessibility = { kind: "decorative" } | { kind: "meaningful"; label: string };

export interface GraphicAriaProps {
  "aria-hidden"?: "true";
  role?: "img";
  "aria-label"?: string;
}

export function getGraphicAriaProps(accessibility: GraphicAccessibility): GraphicAriaProps {
  if (accessibility.kind === "decorative") {
    return { "aria-hidden": "true" };
  }
  return { role: "img", "aria-label": accessibility.label };
}
