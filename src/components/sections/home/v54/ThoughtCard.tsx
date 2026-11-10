import type { V54Card } from "@/lib/home/v54/config";
import { V54IconGlyph } from "./V54Icons";

/**
 * One student question. Real HTML text; position, depth, blur, shadow, the
 * moment of focus and the clarity state are written by the
 * ThoughtMotionController (src/lib/home/v54/motion.ts) — this markup only
 * defines the content. Every card shares one blue-and-white treatment; a
 * card in its moment of focus is simply sharper and a little nearer.
 */
export function ThoughtCard({ card }: { card: V54Card }) {
  return (
    <li className="v54-card" data-v54-card={card.id} data-pathway={card.pathway}>
      <span className="v54-ic">
        <V54IconGlyph name={card.icon} />
      </span>
      <span className="v54-tx">
        <b>
          <span>{card.lines[0]}</span> <span>{card.lines[1]}</span>
        </b>
        <span className="v54-ans">
          <span className="v54-ans-d">{card.answer}</span>
          <span className="v54-ans-m">{card.answerShort}</span>
        </span>
      </span>
    </li>
  );
}
