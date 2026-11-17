import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import { educationLevelLabel, fieldLabel, skillLabel } from "@/lib/careers/labels";
import { getCareerPhoto } from "@/lib/career-explorer/photos";
import type { CareerCardExtras } from "@/lib/supabase/career-explorer";
import type { CareerSummary } from "@/types/career";
import { CareerPhoto } from "./CareerPhoto";
import { CompareToggle } from "./CompareToggle";
import { SaveCareerButton } from "./SaveCareerButton";

/**
 * The V5 career card: photograph, family, title, summary, top skills, the
 * typical education route, save, compare and "Explore career". Every value
 * comes from the career's own record; a part with no data is simply left out.
 */
export function CareerExplorerCard({
  career,
  extras,
  saved,
  sizes = "(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 320px",
  priority = false,
}: {
  career: CareerSummary;
  extras?: CareerCardExtras;
  saved: boolean;
  sizes?: string;
  priority?: boolean;
}) {
  const route = extras?.typicalRoute;
  return (
    <article className="ce-card">
      <CareerPhoto photo={getCareerPhoto(career.slug)} sizes={sizes} priority={priority} decorative />
      <SaveCareerButton careerId={career.id} slug={career.slug} title={career.title} initialSaved={saved} />
      <div className="ce-card-body">
        <p className="ce-kicker">{career.familyName}</p>
        <h3>
          <Link href={`/careers/${career.slug}`}>{career.title}</Link>
        </h3>
        <p className="ce-card-summary">{career.summary}</p>
        {extras && extras.skillKeys.length > 0 ? (
          <ul className="ce-card-chips" aria-label="Key skills" style={{ listStyle: "none", padding: 0 }}>
            {extras.skillKeys.map((key) => (
              <li key={key} className="ce-chip">
                {skillLabel(key)}
              </li>
            ))}
          </ul>
        ) : null}
        {route ? (
          <p className="ce-card-route">
            <GraduationCap aria-hidden="true" />
            <span>
              Typical route: {educationLevelLabel(route.educationLevel)} · {fieldLabel(route.fieldKey)}
            </span>
          </p>
        ) : null}
        <div className="ce-card-foot" style={route ? undefined : { marginTop: "auto" }}>
          <CompareToggle slug={career.slug} title={career.title} />
          <span className="ce-card-open" aria-hidden="true">
            Explore career
            <ArrowRight />
          </span>
        </div>
      </div>
    </article>
  );
}
